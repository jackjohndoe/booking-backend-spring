package com.example.booking.service.impl;

import com.example.booking.dto.listing.ListingFilterRequest;
import com.example.booking.dto.listing.ListingRequest;
import com.example.booking.dto.listing.ListingResponse;
import com.example.booking.entity.Listing;
import com.example.booking.entity.ListingPhoto;
import com.example.booking.entity.User;
import com.example.booking.exception.BadRequestException;
import com.example.booking.exception.ResourceNotFoundException;
import com.example.booking.model.Amenity;
import com.example.booking.model.Policy;
import com.example.booking.repository.FavoriteRepository;
import com.example.booking.repository.ListingPhotoRepository;
import com.example.booking.repository.ListingRepository;
import com.example.booking.service.AuditService;
import com.example.booking.service.ListingService;
import com.example.booking.service.StorageService;
import com.example.booking.specification.ListingSpecifications;
import com.example.booking.util.SecurityUtils;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.LinkedHashSet;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ListingServiceImpl implements ListingService {

    private final ListingRepository listingRepository;
    private final FavoriteRepository favoriteRepository;
    private final ListingPhotoRepository listingPhotoRepository;
    private final StorageService storageService;
    private final AuditService auditService;

    public ListingServiceImpl(ListingRepository listingRepository,
                              FavoriteRepository favoriteRepository,
                              ListingPhotoRepository listingPhotoRepository,
                              StorageService storageService,
                              AuditService auditService) {
        this.listingRepository = listingRepository;
        this.favoriteRepository = favoriteRepository;
        this.listingPhotoRepository = listingPhotoRepository;
        this.storageService = storageService;
        this.auditService = auditService;
    }

    @Override
    public ListingResponse createListing(ListingRequest request, User host) {
        Listing listing = Listing.builder()
                .title(request.getTitle())
                .description(request.getDescription())
                .price(request.getPrice())
                .location(request.getLocation())
                .amenities(convertAmenities(request.getAmenities()))
                .policies(convertPolicies(request.getPolicies()))
                .host(host)
                .build();

        Listing saved = listingRepository.save(listing);
        return toResponse(saved, false);
    }

    @Override
    public ListingResponse updateListing(Long id, ListingRequest request, User host) {
        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with ID: " + id + 
                        ". The listing may have been deleted or the ID may be incorrect."));

        boolean isAdminAction = SecurityUtils.isAdmin(host) && !listing.getHost().getId().equals(host.getId());
        validateOwnership(listing, host);

        listing.setTitle(request.getTitle());
        listing.setDescription(request.getDescription());
        listing.setPrice(request.getPrice());
        listing.setLocation(request.getLocation());
        listing.setAmenities(convertAmenities(request.getAmenities()));
        listing.setPolicies(convertPolicies(request.getPolicies()));

        Listing saved = listingRepository.save(listing);
        
        if (isAdminAction) {
            auditService.logAdminAction(host, "LISTING_UPDATE", "Listing", id, 
                    String.format("Admin updated listing '%s' (owned by user %d)", saved.getTitle(), listing.getHost().getId()));
        }
        
        boolean favorite = host != null && favoriteRepository.existsByUserIdAndListingId(host.getId(), saved.getId());
        return toResponse(saved, favorite);
    }

    @Override
    public void deleteListing(Long id, User host) {
        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with ID: " + id + 
                        ". The listing may have been deleted or the ID may be incorrect."));
        
        boolean isAdminAction = SecurityUtils.isAdmin(host) && (listing.getHost() == null || !listing.getHost().getId().equals(host.getId()));
        String listingTitle = listing.getTitle();
        Long ownerId = listing.getHost() != null ? listing.getHost().getId() : null;
        
        validateOwnership(listing, host);
        
        // Delete associated photos from storage
        listing.getPhotos().forEach(photo -> storageService.delete(photo.getPath()));
        
        listingRepository.delete(listing);
        
        if (isAdminAction) {
            auditService.logAdminAction(host, "LISTING_DELETE", "Listing", id, 
                    String.format("Admin deleted listing '%s' (owned by user %d)", listingTitle, ownerId));
        }
    }

    @Override
    public ListingResponse getListing(Long id, User currentUser) {
        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with ID: " + id + 
                        ". The listing may have been deleted or the ID may be incorrect."));
        boolean favorite = currentUser != null &&
                favoriteRepository.existsByUserIdAndListingId(currentUser.getId(), listing.getId());
        return toResponse(listing, favorite);
    }

    @Override
    public Page<ListingResponse> getAllListings(ListingFilterRequest filter, Pageable pageable, User currentUser) {
        ListingFilterRequest criteria = filter == null ? new ListingFilterRequest(null, null, null, null, null, null) : filter;
        validateDateRange(criteria.startDate(), criteria.endDate());
        validatePriceRange(criteria.minPrice(), criteria.maxPrice());
        Set<Amenity> amenities = convertAmenities(criteria.amenities());

        Specification<Listing> spec = ListingSpecifications.withFilters(
                criteria.location(),
                criteria.minPrice(),
                criteria.maxPrice(),
                amenities,
                criteria.startDate(),
                criteria.endDate()
        );

        final Set<Long> favoriteIds;
        if (currentUser != null) {
            Set<Long> ids = favoriteRepository.findListingIdsByUserId(currentUser.getId());
            favoriteIds = ids == null ? Set.of() : ids;
        } else {
            favoriteIds = Set.of();
        }

        return listingRepository.findAll(spec, pageable)
                .map(listing -> toResponse(listing, favoriteIds.contains(listing.getId())));
    }

    @Override
    public Set<String> addPhotos(Long listingId, User host, List<MultipartFile> files) {
        Listing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + listingId));
        
        boolean isAdminAction = SecurityUtils.isAdmin(host) && (listing.getHost() == null || !listing.getHost().getId().equals(host.getId()));
        validateOwnership(listing, host);

        if (files == null || files.isEmpty()) {
            throw new BadRequestException("No image files provided. Please upload at least one image file (JPG, PNG, etc.) to add photos to your listing.");
        }

        Set<String> urls = new LinkedHashSet<>();
        for (MultipartFile file : files) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            String path = storageService.store(file, "listings/" + listingId);
            ListingPhoto photo = ListingPhoto.builder()
                    .listing(listing)
                    .path(path)
                    .build();
            ListingPhoto savedPhoto = listingPhotoRepository.save(photo);
            listing.getPhotos().add(savedPhoto);
            urls.add(storageService.resolveUrl(path));
        }

        if (urls.isEmpty()) {
            throw new BadRequestException("No valid image files were processed. Please ensure you're uploading valid image files (JPG, PNG, etc.) and that the files are not empty or corrupted.");
        }

        if (isAdminAction) {
            auditService.logAdminAction(host, "LISTING_PHOTO_ADD", "Listing", listingId, 
                    String.format("Admin added %d photo(s) to listing '%s'", urls.size(), listing.getTitle()));
        }

        return urls;
    }

    @Override
    public void removePhoto(Long listingId, Long photoId, User host) {
        Listing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + listingId));
        
        boolean isAdminAction = SecurityUtils.isAdmin(host) && (listing.getHost() == null || !listing.getHost().getId().equals(host.getId()));
        validateOwnership(listing, host);

        ListingPhoto photo = listingPhotoRepository.findByIdAndListingId(photoId, listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Photo not found with ID: " + photoId + 
                        " for listing ID: " + listingId + ". The photo may have been deleted or the ID may be incorrect."));

        listing.getPhotos().remove(photo);
        listingPhotoRepository.delete(photo);
        storageService.delete(photo.getPath());
        
        if (isAdminAction) {
            auditService.logAdminAction(host, "LISTING_PHOTO_DELETE", "Listing", listingId, 
                    String.format("Admin deleted photo %d from listing '%s'", photoId, listing.getTitle()));
        }
    }

    private ListingResponse toResponse(Listing listing, boolean favorite) {
        return ListingResponse.builder()
                .id(listing.getId())
                .title(listing.getTitle())
                .description(listing.getDescription())
                .price(listing.getPrice())
                .location(listing.getLocation())
                .createdAt(listing.getCreatedAt())
                .hostId(listing.getHost() != null ? listing.getHost().getId() : null)
                .hostName(listing.getHost() != null ? listing.getHost().getName() : null)
                .amenities(toStringSet(listing.getAmenities()))
                .policies(toStringSet(listing.getPolicies()))
                .averageRating(listing.getAverageRating())
                .reviewCount(listing.getReviewCount())
                .photos(mapPhotos(listing.getPhotos()))
                .favorite(favorite)
                .build();
    }

    private void validateOwnership(Listing listing, User host) {
        // ADMIN can bypass ownership checks
        if (SecurityUtils.canBypassOwnership(host)) {
            return;
        }
        if (listing.getHost() == null || !listing.getHost().getId().equals(host.getId())) {
            throw new BadRequestException("You do not have permission to modify this listing. " +
                    "Only the listing owner or an administrator can make changes to a listing.");
        }
    }

    private void validateDateRange(LocalDate startDate, LocalDate endDate) {
        if (startDate != null && endDate != null && endDate.isBefore(startDate)) {
            throw new BadRequestException("Invalid date range: The end date must be after the start date. " +
                    "Please select a valid date range for your search.");
        }
    }

    private void validatePriceRange(BigDecimal minPrice, BigDecimal maxPrice) {
        if (minPrice != null && maxPrice != null && maxPrice.compareTo(minPrice) < 0) {
            throw new BadRequestException("Invalid price range: The maximum price (" + maxPrice + 
                    ") must be greater than or equal to the minimum price (" + minPrice + "). Please adjust your price filter.");
        }
    }

    private Set<Amenity> convertAmenities(Set<String> amenities) {
        return toEnumSet(amenities, Amenity.class, "amenities");
    }

    private Set<Policy> convertPolicies(Set<String> policies) {
        return toEnumSet(policies, Policy.class, "policies");
    }

    private <E extends Enum<E>> Set<E> toEnumSet(Set<String> values, Class<E> enumType, String fieldName) {
        if (values == null) {
            return new HashSet<>();
        }

        Set<E> result = new HashSet<>();
        for (String raw : values) {
            if (raw == null) {
                continue;
            }
            String normalized = normalizeEnumValue(raw);
            if (normalized.isEmpty()) {
                continue;
            }
            try {
                result.add(Enum.valueOf(enumType, normalized));
            } catch (IllegalArgumentException ex) {
                throw new BadRequestException("Invalid " + fieldName + " value: '" + raw + 
                        "'. Please check the allowed values for " + fieldName + " and try again.");
            }
        }
        return result;
    }

    private String normalizeEnumValue(String value) {
        return value.trim()
                .replace('-', '_')
                .replace(' ', '_')
                .toUpperCase();
    }

    private Set<String> toStringSet(Set<? extends Enum<?>> values) {
        if (values == null || values.isEmpty()) {
            return Set.of();
        }
        return values.stream()
                .filter(Objects::nonNull)
                .map(Enum::name)
                .collect(Collectors.toSet());
    }

    private Set<String> mapPhotos(Set<ListingPhoto> photos) {
        if (photos == null || photos.isEmpty()) {
            return Set.of();
        }
        return photos.stream()
                .map(ListingPhoto::getPath)
                .filter(path -> path != null && !path.isBlank())
                .map(storageService::resolveUrl)
                .filter(Objects::nonNull)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }
}
