package com.example.booking.controller;

import com.example.booking.dto.booking.BookingRequest;
import com.example.booking.dto.booking.BookingResponse;
import com.example.booking.dto.common.PageResponse;
import com.example.booking.security.BookingUserDetails;
import com.example.booking.service.BookingService;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bookings")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @PostMapping
    public ResponseEntity<BookingResponse> createBooking(@Valid @RequestBody BookingRequest request,
                                                         @AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(bookingService.createBooking(request, userDetails.getUser()));
    }

    @GetMapping("/{id}")
    public ResponseEntity<BookingResponse> getBooking(@PathVariable Long id) {
        return ResponseEntity.ok(bookingService.getBooking(id));
    }

    @GetMapping
    public ResponseEntity<PageResponse<BookingResponse>> getBookings(@AuthenticationPrincipal BookingUserDetails userDetails,
                                                                     @RequestParam(name = "page", defaultValue = "0") int page,
                                                                     @RequestParam(name = "size", defaultValue = "10") int size,
                                                                     @RequestParam(name = "status", required = false) String status) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(PageResponse.from(
                bookingService.getBookingsForUser(userDetails.getUser().getId(), pageable, status)
        ));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancelBooking(@PathVariable Long id,
                                              @AuthenticationPrincipal BookingUserDetails userDetails) {
        bookingService.cancelBooking(id, userDetails.getUser());
        return ResponseEntity.noContent().build();
    }
}
