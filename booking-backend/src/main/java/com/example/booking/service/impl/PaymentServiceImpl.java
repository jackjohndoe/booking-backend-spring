package com.example.booking.service.impl;

import com.example.booking.dto.payment.PaymentRequest;
import com.example.booking.entity.Booking;
import com.example.booking.entity.User;
import com.example.booking.exception.BadRequestException;
import com.example.booking.exception.ResourceNotFoundException;
import com.example.booking.payment.PaymentProvider;
import com.example.booking.payment.dto.PaymentIntentRequest;
import com.example.booking.payment.dto.PaymentIntentResponse;
import com.example.booking.repository.BookingRepository;
import com.example.booking.repository.TransactionRepository;
import com.example.booking.service.PaymentService;
import com.example.booking.service.WalletService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@Transactional
public class PaymentServiceImpl implements PaymentService {

    private final BookingRepository bookingRepository;
    private final TransactionRepository transactionRepository;
    private final WalletService walletService;
    private final PaymentProvider paymentProvider;

    public PaymentServiceImpl(BookingRepository bookingRepository,
                             TransactionRepository transactionRepository,
                             WalletService walletService,
                             PaymentProvider paymentProvider) {
        this.bookingRepository = bookingRepository;
        this.transactionRepository = transactionRepository;
        this.walletService = walletService;
        this.paymentProvider = paymentProvider;
    }

    @Override
    public PaymentIntentResponse processBookingPayment(PaymentRequest request, User user) {
        Booking booking = bookingRepository.findById(request.getBookingId())
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found with ID: " + request.getBookingId() + 
                        ". The booking may have been cancelled or deleted, or the ID may be incorrect."));

        if (!booking.getUser().getId().equals(user.getId())) {
            throw new BadRequestException("You can only make payments for your own bookings. " +
                    "This booking belongs to a different user.");
        }

        if (request.isUseWallet()) {
            return processWalletPayment(booking, user);
        } else {
            return processDirectPayment(booking, user, request.getPaymentMethodId());
        }
    }

    private PaymentIntentResponse processWalletPayment(Booking booking, User user) {
        walletService.processEscrowHold(booking.getId(), booking.getTotalPrice(), user);
        
        return PaymentIntentResponse.builder()
                .paymentIntentId("wallet_" + booking.getId())
                .status("succeeded")
                .amount(booking.getTotalPrice())
                .currency("USD")
                .createdAt(java.time.OffsetDateTime.now())
                .build();
    }

    private PaymentIntentResponse processDirectPayment(Booking booking, User user, String paymentMethodId) {
        PaymentIntentRequest paymentRequest = PaymentIntentRequest.builder()
                .amount(booking.getTotalPrice())
                .currency("USD")
                .customerId(user.getId().toString())
                .description("Payment for booking #" + booking.getId())
                .bookingId(booking.getId().toString())
                .captureImmediately(true)
                .metadata("booking_id=" + booking.getId())
                .build();

        PaymentIntentResponse response = paymentProvider.createPaymentIntent(paymentRequest);
        
        if (response.getClientSecret() != null) {
            PaymentIntentResponse confirmed = paymentProvider.confirmPaymentIntent(response.getPaymentIntentId());
            if ("succeeded".equals(confirmed.getStatus())) {
                walletService.processEscrowHold(booking.getId(), booking.getTotalPrice(), user);
                var escrowTransaction = transactionRepository.findByBookingIdAndType(booking.getId(), 
                        com.example.booking.entity.Transaction.Type.ESCROW_HOLD).orElse(null);
                if (escrowTransaction != null) {
                    escrowTransaction.setExternalPaymentId(confirmed.getPaymentIntentId());
                    transactionRepository.save(escrowTransaction);
                }
            }
            return confirmed;
        }

        return response;
    }

    @Override
    public PaymentIntentResponse refundBooking(Long bookingId, String reason, User user) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found with ID: " + bookingId + 
                        ". The booking may have been cancelled or deleted, or the ID may be incorrect."));

        if (!booking.getUser().getId().equals(user.getId()) && 
            (booking.getListing().getHost() == null || !booking.getListing().getHost().getId().equals(user.getId()))) {
            throw new BadRequestException("You are not authorized to process a refund for this booking. " +
                    "Only the guest who made the booking, the listing host, or an administrator can process refunds.");
        }

        walletService.processRefund(bookingId, reason);

        var escrowTransaction = transactionRepository.findByBookingIdAndType(bookingId, 
                com.example.booking.entity.Transaction.Type.ESCROW_HOLD).orElse(null);
        
        if (escrowTransaction != null && escrowTransaction.getExternalPaymentId() != null) {
            return paymentProvider.refundPayment(escrowTransaction.getExternalPaymentId(), reason);
        }

        return PaymentIntentResponse.builder()
                .paymentIntentId("refund_" + bookingId)
                .status("refunded")
                .amount(booking.getTotalPrice())
                .currency("USD")
                .createdAt(java.time.OffsetDateTime.now())
                .build();
    }
}
