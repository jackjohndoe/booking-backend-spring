package com.example.booking.controller;

import com.example.booking.dto.common.PageResponse;
import com.example.booking.dto.listing.ListingResponse;
import com.example.booking.security.BookingUserDetails;
import com.example.booking.service.FavoriteService;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/favorites")
public class FavoriteController {

    private final FavoriteService favoriteService;

    public FavoriteController(FavoriteService favoriteService) {
        this.favoriteService = favoriteService;
    }

    @PostMapping("/{listingId}")
    public ResponseEntity<Void> addFavorite(@PathVariable Long listingId,
                                            @AuthenticationPrincipal BookingUserDetails userDetails) {
        favoriteService.addFavorite(listingId, userDetails.getUser());
        return ResponseEntity.ok().build();
    }

    @DeleteMapping("/{listingId}")
    public ResponseEntity<Void> removeFavorite(@PathVariable Long listingId,
                                               @AuthenticationPrincipal BookingUserDetails userDetails) {
        favoriteService.removeFavorite(listingId, userDetails.getUser());
        return ResponseEntity.noContent().build();
    }

    @GetMapping
    public ResponseEntity<PageResponse<ListingResponse>> getFavorites(@RequestParam(defaultValue = "0") int page,
                                                                      @RequestParam(defaultValue = "10") int size,
                                                                      @AuthenticationPrincipal BookingUserDetails userDetails) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(PageResponse.from(favoriteService.getFavorites(userDetails.getUser(), pageable)));
    }
}
