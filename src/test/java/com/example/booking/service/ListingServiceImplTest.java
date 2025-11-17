package com.example.booking.service;

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
import com.example.booking.service.impl.ListingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.Mockito;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.mock.web.MockMultipartFile;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ListingServiceImplTest {

    @Mock
    private ListingRepository listingRepository;

    @Mock
    private FavoriteRepository favoriteRepository;

    @Mock
    private ListingPhotoRepository listingPhotoRepository;

    @Mock
    private StorageService storageService;

    @InjectMocks
    private ListingServiceImpl listingService;

    private User host;

    @BeforeEach
    void setUp() {
        host = User.builder()
                .id(1L)
                .name("Host User")
                .email("host@example.com")
                .role(User.Role.HOST)
                .build();
    }

    @Test
    @DisplayName("createListing persists listing with normalized amenity/policy enums")
    void createListing_success() {
        ListingRequest request = new ListingRequest();
        request.setTitle("Modern Loft");
        request.setDescription("Central location");
        request.setPrice(BigDecimal.valueOf(250));
        request.setLocation("Lagos");
        request.setAmenities(Set.of(" wifi ", "POOL"));
        request.setPolicies(Set.of("no pets", "CANCELLATION_STRICT"));

        Listing saved = Listing.builder()
                .id(10L)
                .title(request.getTitle())
                .description(request.getDescription())
                .price(request.getPrice())
                .location(request.getLocation())
                .amenities(Set.of(Amenity.WIFI, Amenity.POOL))
                .policies(Set.of(Policy.NO_PETS, Policy.CANCELLATION_STRICT))
                .host(host)
                .build();

        when(listingRepository.save(any(Listing.class))).thenReturn(saved);

        ListingResponse response = listingService.createListing(request, host);

        ArgumentCaptor<Listing> captor = ArgumentCaptor.forClass(Listing.class);
        verify(listingRepository).save(captor.capture());

        assertThat(captor.getValue().getAmenities()).containsExactlyInAnyOrder(Amenity.WIFI, Amenity.POOL);
        assertThat(captor.getValue().getPolicies()).containsExactlyInAnyOrder(Policy.NO_PETS, Policy.CANCELLATION_STRICT);
        assertThat(response.getId()).isEqualTo(saved.getId());
        assertThat(response.getAmenities()).containsExactlyInAnyOrder("WIFI", "POOL");
        assertThat(response.getPhotos()).isEmpty();
    }

    @Test
    @DisplayName("updateListing applies incoming changes and validates ownership")
    void updateListing_success() {
        Listing listing = Listing.builder()
                .id(15L)
                .title("Old Title")
                .description("Old desc")
                .price(BigDecimal.valueOf(100))
                .location("Abuja")
                .amenities(Set.of(Amenity.TV))
                .policies(Set.of(Policy.NO_SMOKING))
                .host(host)
                .build();

        ListingRequest request = new ListingRequest();
        request.setTitle("New Title");
        request.setDescription("Updated desc");
        request.setPrice(BigDecimal.valueOf(150));
        request.setLocation("Abuja, NG");
        request.setAmenities(Set.of("tv", "wifi"));
        request.setPolicies(Set.of("no_smoking", "quiet_hours"));

        when(listingRepository.findById(listing.getId())).thenReturn(Optional.of(listing));
        when(listingRepository.save(listing)).thenReturn(listing);
        when(favoriteRepository.existsByUserIdAndListingId(host.getId(), listing.getId())).thenReturn(false);

        ListingResponse response = listingService.updateListing(listing.getId(), request, host);

        assertThat(listing.getTitle()).isEqualTo("New Title");
        assertThat(listing.getAmenities()).containsExactlyInAnyOrder(Amenity.TV, Amenity.WIFI);
        assertThat(listing.getPolicies()).containsExactlyInAnyOrder(Policy.NO_SMOKING, Policy.QUIET_HOURS);
        assertThat(response.getHostId()).isEqualTo(host.getId());
    }

    @Test
    @DisplayName("updateListing throws when listing not found")
    void updateListing_notFound() {
        when(listingRepository.findById(999L)).thenReturn(Optional.empty());

        ListingRequest request = new ListingRequest();
        request.setTitle("Title");
        request.setPrice(BigDecimal.TEN);
        request.setLocation("City");

        assertThatThrownBy(() -> listingService.updateListing(999L, request, host))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Listing not found");
    }

    @Test
    @DisplayName("updateListing rejects unauthorized user")
    void updateListing_unauthorized() {
        User otherHost = User.builder().id(2L).role(User.Role.HOST).build();
        Listing listing = Listing.builder().id(20L).host(otherHost).build();

        when(listingRepository.findById(listing.getId())).thenReturn(Optional.of(listing));

        ListingRequest request = new ListingRequest();
        request.setTitle("New Title");
        request.setPrice(BigDecimal.TEN);
        request.setLocation("City");

        assertThatThrownBy(() -> listingService.updateListing(listing.getId(), request, host))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("not allowed");
    }

    @Test
    @DisplayName("createListing throws for invalid amenity value")
    void createListing_invalidAmenity() {
        ListingRequest request = new ListingRequest();
        request.setTitle("Title");
        request.setPrice(BigDecimal.ONE);
        request.setLocation("City");
        request.setAmenities(Set.of("flying_carpet"));

        assertThatThrownBy(() -> listingService.createListing(request, host))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Invalid amenities value");
    }

    @Test
    @DisplayName("getAllListings maps page to responses")
    void getAllListings_success() {
        Listing listing = Listing.builder()
                .id(1L)
                .title("Title")
                .price(BigDecimal.TEN)
                .location("City")
                .amenities(Set.of(Amenity.WIFI))
                .policies(Set.of(Policy.NO_SMOKING))
                .host(host)
                .build();

        Page<Listing> page = new PageImpl<>(List.of(listing));
        when(listingRepository.findAll(Mockito.<Specification<Listing>>any(), any(Pageable.class))).thenReturn(page);
        when(favoriteRepository.findListingIdsByUserId(host.getId())).thenReturn(Set.of(listing.getId()));

        ListingFilterRequest filter = new ListingFilterRequest(null, null, null, null, null, null);
        Page<ListingResponse> result = listingService.getAllListings(filter, PageRequest.of(0, 5), host);

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getAmenities()).containsExactly("WIFI");
        assertThat(result.getContent().get(0).isFavorite()).isTrue();
        verify(listingRepository).findAll(Mockito.<Specification<Listing>>any(), any(Pageable.class));
    }

    @Test
    @DisplayName("getAllListings validates date ranges")
    void getAllListings_invalidDateRange() {
        ListingFilterRequest filter = new ListingFilterRequest(null, null, null, java.time.LocalDate.now().plusDays(5), java.time.LocalDate.now(), null);

        assertThatThrownBy(() -> listingService.getAllListings(filter, PageRequest.of(0, 5), host))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("End date must be after start date");
    }

    @Test
    @DisplayName("getAllListings validates price ranges")
    void getAllListings_invalidPriceRange() {
        ListingFilterRequest filter = new ListingFilterRequest(null, BigDecimal.TEN, BigDecimal.ONE, null, null, null);

        assertThatThrownBy(() -> listingService.getAllListings(filter, PageRequest.of(0, 5), host))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Max price must be greater");
    }

    @Test
    @DisplayName("getListing marks favorite when applicable")
    void getListing_favoriteFlag() {
        Listing listing = Listing.builder()
                .id(55L)
                .title("Beach House")
                .host(host)
                .build();

        when(listingRepository.findById(listing.getId())).thenReturn(Optional.of(listing));
        when(favoriteRepository.existsByUserIdAndListingId(host.getId(), listing.getId())).thenReturn(true);

        ListingResponse response = listingService.getListing(listing.getId(), host);

        assertThat(response.isFavorite()).isTrue();
    }

    @Test
    @DisplayName("addPhotos stores files and returns URLs")
    void addPhotos_success() {
        Listing listing = Listing.builder()
                .id(90L)
                .title("Loft")
                .host(host)
                .build();

        MockMultipartFile file = new MockMultipartFile("files", "photo.jpg", "image/jpeg", "data".getBytes());
        String directory = "listings/" + listing.getId();
        String storedPath = directory + "/photo.jpg";

        when(listingRepository.findById(listing.getId())).thenReturn(Optional.of(listing));
        when(storageService.store(any(), eq(directory))).thenReturn(storedPath);
        when(storageService.resolveUrl(storedPath)).thenReturn("http://localhost/api/files/" + storedPath);
        when(listingPhotoRepository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        Set<String> urls = listingService.addPhotos(listing.getId(), host, List.of(file));

        assertThat(urls).contains("http://localhost/api/files/" + storedPath);
        verify(storageService).store(any(), eq(directory));
        assertThat(listing.getPhotos()).hasSize(1);
    }

    @Test
    @DisplayName("removePhoto deletes stored file")
    void removePhoto_success() {
        Listing listing = Listing.builder()
                .id(91L)
                .host(host)
                .build();

        ListingPhoto photo = ListingPhoto.builder()
                .id(5L)
                .listing(listing)
                .path("listings/91/photo.jpg")
                .build();
        listing.getPhotos().add(photo);

        when(listingRepository.findById(listing.getId())).thenReturn(Optional.of(listing));
        when(listingPhotoRepository.findByIdAndListingId(photo.getId(), listing.getId())).thenReturn(Optional.of(photo));

        listingService.removePhoto(listing.getId(), photo.getId(), host);

        verify(storageService).delete("listings/91/photo.jpg");
        verify(listingPhotoRepository).delete(photo);
        assertThat(listing.getPhotos()).isEmpty();
    }
}
