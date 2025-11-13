package com.example.booking.service;

import com.example.booking.dto.listing.ListingFilterRequest;
import com.example.booking.dto.listing.ListingRequest;
import com.example.booking.dto.listing.ListingResponse;
import com.example.booking.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface ListingService {
    ListingResponse createListing(ListingRequest request, User host);
    ListingResponse updateListing(Long id, ListingRequest request, User host);
    void deleteListing(Long id, User host);
    ListingResponse getListing(Long id);
    Page<ListingResponse> getAllListings(ListingFilterRequest filter, Pageable pageable);
}
