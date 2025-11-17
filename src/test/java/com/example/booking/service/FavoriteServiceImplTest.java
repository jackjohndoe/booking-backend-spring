package com.example.booking.service;

import com.example.booking.dto.listing.ListingResponse;
import com.example.booking.entity.Favorite;
import com.example.booking.entity.Listing;
import com.example.booking.entity.User;
import com.example.booking.exception.BadRequestException;
import com.example.booking.exception.ResourceNotFoundException;
import com.example.booking.repository.FavoriteRepository;
import com.example.booking.repository.ListingRepository;
import com.example.booking.service.impl.FavoriteServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class FavoriteServiceImplTest {

    @Mock
    private FavoriteRepository favoriteRepository;

    @Mock
    private ListingRepository listingRepository;

    @Mock
    private ListingService listingService;

    @InjectMocks
    private FavoriteServiceImpl favoriteService;

    private User user;
    private Listing listing;

    @BeforeEach
    void setUp() {
        user = User.builder().id(1L).name("Guest").role(User.Role.GUEST).build();
        listing = Listing.builder().id(10L).title("Loft").build();
    }

    @Test
    @DisplayName("addFavorite saves new favorite")
    void addFavorite_success() {
        when(favoriteRepository.existsByUserIdAndListingId(user.getId(), listing.getId())).thenReturn(false);
        when(listingRepository.findById(listing.getId())).thenReturn(Optional.of(listing));

        favoriteService.addFavorite(listing.getId(), user);

        verify(favoriteRepository).save(any(Favorite.class));
    }

    @Test
    @DisplayName("addFavorite rejects duplicates")
    void addFavorite_duplicate() {
        when(favoriteRepository.existsByUserIdAndListingId(user.getId(), listing.getId())).thenReturn(true);

        assertThatThrownBy(() -> favoriteService.addFavorite(listing.getId(), user))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("addFavorite throws when listing missing")
    void addFavorite_listingNotFound() {
        when(favoriteRepository.existsByUserIdAndListingId(user.getId(), listing.getId())).thenReturn(false);
        when(listingRepository.findById(listing.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> favoriteService.addFavorite(listing.getId(), user))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("removeFavorite removes when existing")
    void removeFavorite_success() {
        when(favoriteRepository.existsByUserIdAndListingId(user.getId(), listing.getId())).thenReturn(true);

        favoriteService.removeFavorite(listing.getId(), user);

        verify(favoriteRepository).deleteByUserIdAndListingId(user.getId(), listing.getId());
    }

    @Test
    @DisplayName("removeFavorite rejects when not present")
    void removeFavorite_notPresent() {
        when(favoriteRepository.existsByUserIdAndListingId(user.getId(), listing.getId())).thenReturn(false);

        assertThatThrownBy(() -> favoriteService.removeFavorite(listing.getId(), user))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("getFavorites maps listings via listing service")
    void getFavorites_success() {
        Favorite favorite = Favorite.builder()
                .id(5L)
                .listing(listing)
                .user(user)
                .createdAt(OffsetDateTime.now())
                .build();

        Page<Favorite> page = new PageImpl<>(List.of(favorite));
        when(favoriteRepository.findByUserId(eq(user.getId()), any(Pageable.class))).thenReturn(page);

        ListingResponse listingResponse = ListingResponse.builder()
                .id(listing.getId())
                .title(listing.getTitle())
                .photos(Set.of())
                .favorite(true)
                .build();
        when(listingService.getListing(listing.getId(), user)).thenReturn(listingResponse);

        Page<ListingResponse> result = favoriteService.getFavorites(user, PageRequest.of(0, 5));

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).isFavorite()).isTrue();
    }
}
