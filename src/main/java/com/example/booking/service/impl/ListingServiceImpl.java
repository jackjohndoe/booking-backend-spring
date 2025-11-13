package com.example.booking.service.impl;

import com.example.booking.dto.listing.ListingRequest;
import com.example.booking.dto.listing.ListingResponse;
import com.example.booking.entity.Listing;
import com.example.booking.entity.User;
import com.example.booking.exception.BadRequestException;
import com.example.booking.exception.ResourceNotFoundException;
import com.example.booking.model.Amenity;
import com.example.booking.model.Policy;
import com.example.booking.repository.ListingRepository;
import com.example.booking.service.ListingService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.util.HashSet;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class ListingServiceImpl implements ListingService {

    private final ListingRepository listingRepository;

    public ListingServiceImpl(ListingRepository listingRepository) {
        this.listingRepository = listingRepository;
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
        return toResponse(saved);
    }

    @Override
    public ListingResponse updateListing(Long id, ListingRequest request, User host) {
        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + id));

        validateOwnership(listing, host);

        listing.setTitle(request.getTitle());
        listing.setDescription(request.getDescription());
        listing.setPrice(request.getPrice());
        listing.setLocation(request.getLocation());
        listing.setAmenities(convertAmenities(request.getAmenities()));
        listing.setPolicies(convertPolicies(request.getPolicies()));

        return toResponse(listingRepository.save(listing));
    }

    @Override
    public void deleteListing(Long id, User host) {
        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + id));
        validateOwnership(listing, host);
        listingRepository.delete(listing);
    }

    @Override
    public ListingResponse getListing(Long id) {
        Listing listing = listingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + id));
        return toResponse(listing);
    }

    @Override
    public Page<ListingResponse> getAllListings(Pageable pageable) {
        return listingRepository.findAll(pageable).map(this::toResponse);
    }

    private ListingResponse toResponse(Listing listing) {
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
                .build();
    }

    private void validateOwnership(Listing listing, User host) {
        if (listing.getHost() == null || !listing.getHost().getId().equals(host.getId())) {
            throw new BadRequestException("You are not allowed to modify this listing");
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
                throw new BadRequestException("Invalid " + fieldName + " value: " + raw);
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
}
