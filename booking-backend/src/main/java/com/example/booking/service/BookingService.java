package com.example.booking.service;

import com.example.booking.dto.booking.BookingRequest;
import com.example.booking.dto.booking.BookingResponse;
import com.example.booking.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

public interface BookingService {
    BookingResponse createBooking(BookingRequest request, User user);
    BookingResponse getBooking(Long id);
    Page<BookingResponse> getBookingsForUser(Long userId, Pageable pageable, String status);
    void cancelBooking(Long id, User user);
}
