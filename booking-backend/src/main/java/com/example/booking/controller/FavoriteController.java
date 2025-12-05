package com.example.booking.controller;

import com.example.booking.dto.common.PageResponse;
import com.example.booking.dto.listing.ListingResponse;
import com.example.booking.security.BookingUserDetails;
import com.example.booking.service.FavoriteService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/favorites")
@Tag(name = "Favorites", description = "User favorite listings management endpoints")
public class FavoriteController {

    private final FavoriteService favoriteService;

    public FavoriteController(FavoriteService favoriteService) {
        this.favoriteService = favoriteService;
    }

    @Operation(summary = "Add listing to favorites", description = "Adds a listing to the authenticated user's favorites")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Listing added to favorites"),
            @ApiResponse(responseCode = "400", description = "Listing already in favorites"),
            @ApiResponse(responseCode = "404", description = "Listing not found")
    })
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/{listingId}")
    public ResponseEntity<Void> addFavorite(
            @Parameter(description = "Listing ID") @PathVariable Long listingId,
            @AuthenticationPrincipal BookingUserDetails userDetails) {
        favoriteService.addFavorite(listingId, userDetails.getUser());
        return ResponseEntity.ok().build();
    }

    @Operation(summary = "Remove listing from favorites", description = "Removes a listing from the authenticated user's favorites")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Listing removed from favorites"),
            @ApiResponse(responseCode = "400", description = "Listing not in favorites")
    })
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{listingId}")
    public ResponseEntity<Void> removeFavorite(
            @Parameter(description = "Listing ID") @PathVariable Long listingId,
            @AuthenticationPrincipal BookingUserDetails userDetails) {
        favoriteService.removeFavorite(listingId, userDetails.getUser());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Get user favorites", description = "Retrieves paginated list of the authenticated user's favorite listings")
    @ApiResponse(responseCode = "200", description = "Favorites retrieved successfully",
            content = @Content(schema = @Schema(implementation = PageResponse.class)))
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping
    public ResponseEntity<PageResponse<ListingResponse>> getFavorites(
            @Parameter(description = "Page number (0-indexed)") @RequestParam(defaultValue = "0", name = "page") int page,
            @Parameter(description = "Page size") @RequestParam(defaultValue = "10", name = "size") int size,
            @AuthenticationPrincipal BookingUserDetails userDetails) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(PageResponse.from(favoriteService.getFavorites(userDetails.getUser(), pageable)));
    }
}
