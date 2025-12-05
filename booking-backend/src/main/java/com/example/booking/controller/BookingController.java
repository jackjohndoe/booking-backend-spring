package com.example.booking.controller;

import com.example.booking.dto.booking.BookingRequest;
import com.example.booking.dto.booking.BookingResponse;
import com.example.booking.dto.common.PageResponse;
import com.example.booking.security.BookingUserDetails;
import com.example.booking.service.BookingService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/bookings")
@Tag(name = "Bookings", description = "Booking management endpoints")
public class BookingController {

    private final BookingService bookingService;

    public BookingController(BookingService bookingService) {
        this.bookingService = bookingService;
    }

    @Operation(summary = "Create a booking", description = "Creates a new booking for a listing. Requires authentication.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Booking created successfully",
                    content = @Content(schema = @Schema(implementation = BookingResponse.class))),
            @ApiResponse(responseCode = "400", description = "Invalid dates or listing unavailable"),
            @ApiResponse(responseCode = "404", description = "Listing not found")
    })
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping
    public ResponseEntity<BookingResponse> createBooking(@Valid @RequestBody BookingRequest request,
                                                         @AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(bookingService.createBooking(request, userDetails.getUser()));
    }

    @Operation(summary = "Get a booking by ID", description = "Retrieves booking details by ID")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Booking retrieved successfully",
                    content = @Content(schema = @Schema(implementation = BookingResponse.class))),
            @ApiResponse(responseCode = "404", description = "Booking not found")
    })
    @GetMapping("/{id}")
    public ResponseEntity<BookingResponse> getBooking(
            @Parameter(description = "Booking ID") @PathVariable Long id) {
        return ResponseEntity.ok(bookingService.getBooking(id));
    }

    @Operation(summary = "Get user bookings", description = "Retrieves paginated bookings for the authenticated user with optional status filter")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Bookings retrieved successfully",
                    content = @Content(schema = @Schema(implementation = PageResponse.class)))
    })
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping
    public ResponseEntity<PageResponse<BookingResponse>> getBookings(
            @AuthenticationPrincipal BookingUserDetails userDetails,
            @Parameter(description = "Page number (0-indexed)") @RequestParam(name = "page", defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(name = "size", defaultValue = "10") int size,
            @Parameter(description = "Filter by status: PAST, CURRENT, UPCOMING") @RequestParam(name = "status", required = false) String status) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(PageResponse.from(
                bookingService.getBookingsForUser(userDetails.getUser().getId(), pageable, status)
        ));
    }

    @Operation(summary = "Cancel a booking", description = "Cancels a booking and processes refund. Guest, host, or ADMIN can cancel.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "204", description = "Booking cancelled successfully"),
            @ApiResponse(responseCode = "400", description = "Unauthorized"),
            @ApiResponse(responseCode = "404", description = "Booking not found")
    })
    @SecurityRequirement(name = "bearerAuth")
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> cancelBooking(
            @Parameter(description = "Booking ID") @PathVariable Long id,
            @AuthenticationPrincipal BookingUserDetails userDetails) {
        bookingService.cancelBooking(id, userDetails.getUser());
        return ResponseEntity.noContent().build();
    }

    @Operation(summary = "Complete a booking", description = "Marks booking as complete and releases escrow funds to host. Host or ADMIN can complete.")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Booking completed successfully"),
            @ApiResponse(responseCode = "400", description = "Unauthorized or escrow not found"),
            @ApiResponse(responseCode = "404", description = "Booking not found")
    })
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/{id}/complete")
    public ResponseEntity<Void> completeBooking(
            @Parameter(description = "Booking ID") @PathVariable Long id,
            @AuthenticationPrincipal BookingUserDetails userDetails) {
        bookingService.completeBooking(id, userDetails.getUser());
        return ResponseEntity.ok().build();
    }
}
