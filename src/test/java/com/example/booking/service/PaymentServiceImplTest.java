package com.example.booking.service;

import com.example.booking.dto.payment.PaymentRequest;
import com.example.booking.entity.Booking;
import com.example.booking.entity.Listing;
import com.example.booking.entity.Transaction;
import com.example.booking.entity.User;
import com.example.booking.exception.BadRequestException;
import com.example.booking.payment.PaymentProvider;
import com.example.booking.payment.dto.PaymentIntentRequest;
import com.example.booking.payment.dto.PaymentIntentResponse;
import com.example.booking.repository.BookingRepository;
import com.example.booking.repository.TransactionRepository;
import com.example.booking.service.impl.PaymentServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PaymentServiceImplTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private WalletService walletService;

    @Mock
    private PaymentProvider paymentProvider;

    @InjectMocks
    private PaymentServiceImpl paymentService;

    private User guest;
    private User host;
    private Listing listing;
    private Booking booking;

    @BeforeEach
    void setUp() {
        guest = User.builder().id(1L).role(User.Role.GUEST).build();
        host = User.builder().id(2L).role(User.Role.HOST).build();
        listing = Listing.builder().id(100L).host(host).build();
        booking = Booking.builder()
                .id(50L)
                .user(guest)
                .listing(listing)
                .totalPrice(BigDecimal.valueOf(200))
                .startDate(LocalDate.now().plusDays(1))
                .endDate(LocalDate.now().plusDays(3))
                .build();
    }

    @Test
    @DisplayName("processBookingPayment with wallet processes escrow hold")
    void processBookingPayment_wallet() {
        PaymentRequest request = new PaymentRequest();
        request.setBookingId(booking.getId());
        request.setUseWallet(true);

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        PaymentIntentResponse response = paymentService.processBookingPayment(request, guest);

        assertThat(response.getStatus()).isEqualTo("succeeded");
        verify(walletService).processEscrowHold(booking.getId(), booking.getTotalPrice(), guest);
        verify(paymentProvider, never()).createPaymentIntent(any());
    }

    @Test
    @DisplayName("processBookingPayment with direct payment uses provider")
    void processBookingPayment_direct() {
        PaymentRequest request = new PaymentRequest();
        request.setBookingId(booking.getId());
        request.setUseWallet(false);
        request.setPaymentMethodId("pm_123");

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(paymentProvider.createPaymentIntent(any(PaymentIntentRequest.class))).thenReturn(
                PaymentIntentResponse.builder()
                        .paymentIntentId("pi_123")
                        .clientSecret("pi_123_secret")
                        .status("requires_payment_method")
                        .build());
        when(paymentProvider.confirmPaymentIntent("pi_123")).thenReturn(
                PaymentIntentResponse.builder()
                        .paymentIntentId("pi_123")
                        .status("succeeded")
                        .build());
        when(transactionRepository.findByBookingIdAndType(any(), any())).thenReturn(Optional.empty());

        PaymentIntentResponse response = paymentService.processBookingPayment(request, guest);

        assertThat(response.getStatus()).isEqualTo("succeeded");
        verify(paymentProvider).createPaymentIntent(any(PaymentIntentRequest.class));
        verify(paymentProvider).confirmPaymentIntent("pi_123");
        verify(walletService).processEscrowHold(booking.getId(), booking.getTotalPrice(), guest);
    }

    @Test
    @DisplayName("processBookingPayment rejects unauthorized user")
    void processBookingPayment_unauthorized() {
        PaymentRequest request = new PaymentRequest();
        request.setBookingId(booking.getId());

        User stranger = User.builder().id(999L).build();
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        assertThatThrownBy(() -> paymentService.processBookingPayment(request, stranger))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("own bookings");
    }

    @Test
    @DisplayName("refundBooking processes refund via wallet service")
    void refundBooking_success() {
        Transaction escrowHold = Transaction.builder()
                .id(1L)
                .booking(booking)
                .type(Transaction.Type.ESCROW_HOLD)
                .externalPaymentId("pi_123")
                .build();

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(transactionRepository.findByBookingIdAndType(booking.getId(), Transaction.Type.ESCROW_HOLD))
                .thenReturn(Optional.of(escrowHold));
        when(paymentProvider.refundPayment("pi_123", "Cancelled")).thenReturn(
                PaymentIntentResponse.builder()
                        .paymentIntentId("pi_123")
                        .status("refunded")
                        .build());

        PaymentIntentResponse response = paymentService.refundBooking(booking.getId(), "Cancelled", guest);

        assertThat(response.getStatus()).isEqualTo("refunded");
        verify(walletService).processRefund(booking.getId(), "Cancelled");
        verify(paymentProvider).refundPayment("pi_123", "Cancelled");
    }
}
