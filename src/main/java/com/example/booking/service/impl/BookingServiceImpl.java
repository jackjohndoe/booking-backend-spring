package com.example.booking.service.impl;

import com.example.booking.dto.booking.BookingRequest;
import com.example.booking.dto.booking.BookingResponse;
import com.example.booking.entity.Booking;
import com.example.booking.entity.Listing;
import com.example.booking.entity.User;
import com.example.booking.exception.BadRequestException;
import com.example.booking.exception.ResourceNotFoundException;
import com.example.booking.repository.BookingRepository;
import com.example.booking.repository.ListingRepository;
import com.example.booking.service.BookingService;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;

@Service
public class BookingServiceImpl implements BookingService {

    private final BookingRepository bookingRepository;
    private final ListingRepository listingRepository;

    public BookingServiceImpl(BookingRepository bookingRepository, ListingRepository listingRepository) {
        this.bookingRepository = bookingRepository;
        this.listingRepository = listingRepository;
    }

    @Override
    public BookingResponse createBooking(BookingRequest request, User user) {
        Listing listing = listingRepository.findById(request.getListingId())
                .orElseThrow(() -> new ResourceNotFoundException("Listing not found with id: " + request.getListingId()));

        validateDates(request.getStartDate(), request.getEndDate());
        validateAvailability(listing.getId(), request.getStartDate(), request.getEndDate());

        Booking booking = Booking.builder()
                .user(user)
                .listing(listing)
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .totalPrice(request.getTotalPrice())
                .build();

        return toResponse(bookingRepository.save(booking));
    }

    @Override
    public BookingResponse getBooking(Long id) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found with id: " + id));
        return toResponse(booking);
    }

    @Override
    public Page<BookingResponse> getBookingsForUser(Long userId, Pageable pageable) {
        return bookingRepository.findByUserId(userId, pageable).map(this::toResponse);
    }

    @Override
    public void cancelBooking(Long id, User user) {
        Booking booking = bookingRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found with id: " + id));

        if (!booking.getUser().getId().equals(user.getId()) &&
                (booking.getListing().getHost() == null || !booking.getListing().getHost().getId().equals(user.getId()))) {
            throw new BadRequestException("You are not allowed to cancel this booking");
        }

        bookingRepository.delete(booking);
    }

    private BookingResponse toResponse(Booking booking) {
        return BookingResponse.builder()
                .id(booking.getId())
                .listingId(booking.getListing().getId())
                .userId(booking.getUser().getId())
                .startDate(booking.getStartDate())
                .endDate(booking.getEndDate())
                .totalPrice(booking.getTotalPrice())
                .build();
    }

    private void validateDates(LocalDate startDate, LocalDate endDate) {
        if (endDate.isBefore(startDate)) {
            throw new BadRequestException("End date must be after start date");
        }
    }

    private void validateAvailability(Long listingId, LocalDate startDate, LocalDate endDate) {
        List<Booking> overlapping = bookingRepository.findOverlappingBookings(listingId, startDate, endDate);
        if (!overlapping.isEmpty()) {
            throw new BadRequestException("Listing already booked for the selected dates");
        }
    }
}
