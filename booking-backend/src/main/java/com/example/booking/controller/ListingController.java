package com.example.booking.controller;

import com.example.booking.dto.common.PageResponse;
import com.example.booking.dto.listing.ListingFilterRequest;
import com.example.booking.dto.listing.ListingRequest;
import com.example.booking.dto.listing.ListingResponse;
import com.example.booking.model.Amenity;
import com.example.booking.model.Policy;
import com.example.booking.security.BookingUserDetails;
import com.example.booking.service.ListingService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/listings")
public class ListingController {

    private final ListingService listingService;

    public ListingController(ListingService listingService) {
        this.listingService = listingService;
    }

    @PostMapping
    public ResponseEntity<ListingResponse> createListing(@Valid @RequestBody ListingRequest request,
                                                         @AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(listingService.createListing(request, userDetails.getUser()));
    }

    @PutMapping("/{id}")
    public ResponseEntity<ListingResponse> updateListing(@PathVariable Long id,
                                                         @Valid @RequestBody ListingRequest request,
                                                         @AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(listingService.updateListing(id, request, userDetails.getUser()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteListing(@PathVariable Long id,
                                              @AuthenticationPrincipal BookingUserDetails userDetails) {
        listingService.deleteListing(id, userDetails.getUser());
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/vocab")
    public ResponseEntity<Map<String, Set<String>>> getListingVocabulary() {
        return ResponseEntity.ok(Map.of(
                "amenities", Amenity.names(),
                "policies", Policy.names()
        ));
    }

    @GetMapping("/{id}")
    public ResponseEntity<ListingResponse> getListing(@PathVariable Long id) {
        return ResponseEntity.ok(listingService.getListing(id));
    }

    @GetMapping
    public ResponseEntity<PageResponse<ListingResponse>> getListings(@ModelAttribute ListingFilterRequest filter,
                                                                     @RequestParam(name = "page", defaultValue = "0") int page,
                                                                     @RequestParam(name = "size", defaultValue = "10") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(PageResponse.from(listingService.getAllListings(filter, pageable)));
    }
}
