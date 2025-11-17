package com.example.booking.service;

import com.example.booking.dto.listing.ListingResponse;
import com.example.booking.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface FavoriteService {
    void addFavorite(Long listingId, User user);
    void removeFavorite(Long listingId, User user);
    Page<ListingResponse> getFavorites(User user, Pageable pageable);
}
