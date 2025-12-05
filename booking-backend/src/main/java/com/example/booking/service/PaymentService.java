package com.example.booking.service;

import com.example.booking.dto.payment.PaymentRequest;
import com.example.booking.entity.User;
import com.example.booking.payment.dto.PaymentIntentResponse;

public interface PaymentService {
    PaymentIntentResponse processBookingPayment(PaymentRequest request, User user);
    PaymentIntentResponse refundBooking(Long bookingId, String reason, User user);
}
