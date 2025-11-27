package com.example.booking.service.impl;

import com.example.booking.dto.listing.ListingResponse;
import com.example.booking.entity.Favorite;
import com.example.booking.entity.Listing;
import com.example.booking.entity.User;
import com.example.booking.exception.BadRequestException;
import com.example.booking.exception.ResourceNotFoundException;
import com.example.booking.repository.FavoriteRepository;
import com.example.booking.repository.ListingRepository;
import com.example.booking.service.FavoriteService;
import com.example.booking.service.ListingService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class FavoriteServiceImpl implements FavoriteService {

    private final FavoriteRepository favoriteRepository;
    private final ListingRepository listingRepository;
    private final ListingService listingService;

    public FavoriteServiceImpl(FavoriteRepository favoriteRepository,
                               ListingRepository listingRepository,
                               ListingService listingService) {
        this.favoriteRepository = favoriteRepository;
        this.listingRepository = listingRepository;
        this.listingService = listingService;
    }

    @Override
    public void addFavorite(Long listingId, User user) {
        if (favoriteRepository.existsByUserIdAndListingId(user.getId(), listingId)) {
            throw new BadRequestException("This listing is already in your favorites. " +
                    "You can view all your favorite listings in your favorites page.");
        }

        Listing listing = listingRepository.findById(listingId)
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with ID: " + listingId + 
                        ". The listing may have been deleted or the ID may be incorrect."));

        Favorite favorite = Favorite.builder()
                .listing(listing)
                .user(user)
                .build();
        favoriteRepository.save(favorite);
    }

    @Override
    public void removeFavorite(Long listingId, User user) {
        if (!favoriteRepository.existsByUserIdAndListingId(user.getId(), listingId)) {
            throw new BadRequestException("This listing is not in your favorites. " +
                    "You can only remove listings that are currently in your favorites list.");
        }
        favoriteRepository.deleteByUserIdAndListingId(user.getId(), listingId);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<ListingResponse> getFavorites(User user, Pageable pageable) {
        return favoriteRepository.findByUserId(user.getId(), pageable)
                .map(favorite -> listingService.getListing(favorite.getListing().getId(), user));
    }
}
