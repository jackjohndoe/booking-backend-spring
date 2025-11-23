package com.example.booking.service;

import com.example.booking.dto.wallet.DepositRequest;
import com.example.booking.dto.wallet.TransactionResponse;
import com.example.booking.dto.wallet.WalletResponse;
import com.example.booking.dto.wallet.WithdrawalRequest;
import com.example.booking.entity.Booking;
import com.example.booking.entity.Transaction;
import com.example.booking.entity.User;
import com.example.booking.entity.Wallet;
import com.example.booking.exception.BadRequestException;
import com.example.booking.payment.PaymentProvider;
import com.example.booking.payment.dto.PaymentIntentResponse;
import com.example.booking.payment.dto.PayoutRequest;
import com.example.booking.payment.dto.PayoutResponse;
import com.example.booking.repository.BookingRepository;
import com.example.booking.repository.TransactionRepository;
import com.example.booking.repository.WalletRepository;
import com.example.booking.service.impl.WalletServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class WalletServiceImplTest {

    @Mock
    private WalletRepository walletRepository;

    @Mock
    private TransactionRepository transactionRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private PaymentProvider paymentProvider;

    @InjectMocks
    private WalletServiceImpl walletService;

    private User user;
    private Wallet wallet;

    @BeforeEach
    void setUp() {
        user = User.builder().id(1L).name("Test User").role(User.Role.GUEST).build();
        wallet = Wallet.builder()
                .id(10L)
                .user(user)
                .balance(BigDecimal.valueOf(100))
                .currency("USD")
                .status(Wallet.Status.ACTIVE)
                .build();
    }

    @Test
    @DisplayName("getOrCreateWallet returns existing wallet")
    void getOrCreateWallet_existing() {
        when(walletRepository.findByUserId(user.getId())).thenReturn(Optional.of(wallet));

        WalletResponse response = walletService.getOrCreateWallet(user);

        assertThat(response.getBalance()).isEqualTo(BigDecimal.valueOf(100));
        verify(walletRepository, never()).save(any());
    }

    @Test
    @DisplayName("getOrCreateWallet creates new wallet if missing")
    void getOrCreateWallet_createsNew() {
        when(walletRepository.findByUserId(user.getId())).thenReturn(Optional.empty());
        when(walletRepository.save(any(Wallet.class))).thenAnswer(invocation -> {
            Wallet w = invocation.getArgument(0);
            w.setId(20L);
            return w;
        });

        WalletResponse response = walletService.getOrCreateWallet(user);

        assertThat(response.getBalance()).isEqualTo(BigDecimal.ZERO);
        verify(walletRepository).save(any(Wallet.class));
    }

    @Test
    @DisplayName("deposit adds funds to wallet")
    void deposit_success() {
        DepositRequest request = new DepositRequest();
        request.setAmount(BigDecimal.valueOf(50));
        request.setDescription("Top up");

        when(walletRepository.findByUserIdWithLock(user.getId())).thenReturn(Optional.of(wallet));
        when(paymentProvider.createPaymentIntent(any())).thenReturn(
                PaymentIntentResponse.builder()
                        .paymentIntentId("pi_123")
                        .status("requires_payment_method")
                        .build());
        when(paymentProvider.confirmPaymentIntent("pi_123")).thenReturn(
                PaymentIntentResponse.builder()
                        .paymentIntentId("pi_123")
                        .status("succeeded")
                        .build());
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TransactionResponse response = walletService.deposit(request, user);

        assertThat(response.getType()).isEqualTo("DEPOSIT");
        assertThat(response.getStatus()).isEqualTo("COMPLETED");
        assertThat(wallet.getBalance()).isEqualTo(BigDecimal.valueOf(150));
        verify(walletRepository).save(wallet);
    }

    @Test
    @DisplayName("withdraw deducts from wallet balance")
    void withdraw_success() {
        WithdrawalRequest request = new WithdrawalRequest();
        request.setAmount(BigDecimal.valueOf(30));
        request.setDestinationAccountId("acc_123");

        when(walletRepository.findByUserIdWithLock(user.getId())).thenReturn(Optional.of(wallet));
        when(paymentProvider.createPayout(any(PayoutRequest.class))).thenReturn(
                PayoutResponse.builder()
                        .payoutId("po_123")
                        .status("pending")
                        .amount(request.getAmount())
                        .build());
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(invocation -> invocation.getArgument(0));

        TransactionResponse response = walletService.withdraw(request, user);

        assertThat(response.getType()).isEqualTo("WITHDRAWAL");
        assertThat(wallet.getBalance()).isEqualTo(BigDecimal.valueOf(70));
        verify(walletRepository).save(wallet);
    }

    @Test
    @DisplayName("withdraw throws on insufficient balance")
    void withdraw_insufficientBalance() {
        WithdrawalRequest request = new WithdrawalRequest();
        request.setAmount(BigDecimal.valueOf(200));

        when(walletRepository.findByUserIdWithLock(user.getId())).thenReturn(Optional.of(wallet));

        assertThatThrownBy(() -> walletService.withdraw(request, user))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("Insufficient balance");
    }

    @Test
    @DisplayName("processEscrowHold deducts from wallet")
    void processEscrowHold_success() {
        Booking booking = Booking.builder()
                .id(100L)
                .user(user)
                .totalPrice(BigDecimal.valueOf(50))
                .build();

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(walletRepository.findByUserIdWithLock(user.getId())).thenReturn(Optional.of(wallet));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(invocation -> invocation.getArgument(0));

        walletService.processEscrowHold(booking.getId(), BigDecimal.valueOf(50), user);

        assertThat(wallet.getBalance()).isEqualTo(BigDecimal.valueOf(50));
        verify(transactionRepository).save(any(Transaction.class));
        verify(walletRepository).save(wallet);
    }

    @Test
    @DisplayName("processEscrowRelease transfers to host with platform fee")
    void processEscrowRelease_success() {
        User host = User.builder().id(2L).role(User.Role.HOST).build();
        Booking booking = Booking.builder()
                .id(200L)
                .user(user)
                .totalPrice(BigDecimal.valueOf(100))
                .build();

        Transaction escrowHold = Transaction.builder()
                .id(1L)
                .booking(booking)
                .type(Transaction.Type.ESCROW_HOLD)
                .amount(BigDecimal.valueOf(100))
                .build();

        Wallet hostWallet = Wallet.builder()
                .id(30L)
                .user(host)
                .balance(BigDecimal.ZERO)
                .build();

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(transactionRepository.findByBookingIdAndType(booking.getId(), Transaction.Type.ESCROW_HOLD))
                .thenReturn(Optional.of(escrowHold));
        when(walletRepository.findByUserIdWithLock(host.getId())).thenReturn(Optional.of(hostWallet));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(invocation -> invocation.getArgument(0));

        walletService.processEscrowRelease(booking.getId(), host);

        assertThat(hostWallet.getBalance()).isEqualTo(BigDecimal.valueOf(90));
        verify(transactionRepository, times(2)).save(any(Transaction.class));
        verify(walletRepository).save(hostWallet);
    }

    @Test
    @DisplayName("processRefund returns funds to wallet")
    void processRefund_success() {
        Booking booking = Booking.builder()
                .id(300L)
                .user(user)
                .totalPrice(BigDecimal.valueOf(75))
                .build();

        Transaction escrowHold = Transaction.builder()
                .id(2L)
                .wallet(wallet)
                .booking(booking)
                .type(Transaction.Type.ESCROW_HOLD)
                .amount(BigDecimal.valueOf(75))
                .build();

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(transactionRepository.findByBookingIdAndType(booking.getId(), Transaction.Type.ESCROW_HOLD))
                .thenReturn(Optional.of(escrowHold));
        when(walletRepository.findByUserIdWithLock(user.getId())).thenReturn(Optional.of(wallet));
        when(transactionRepository.save(any(Transaction.class))).thenAnswer(invocation -> invocation.getArgument(0));

        walletService.processRefund(booking.getId(), "Cancelled by user");

        assertThat(wallet.getBalance()).isEqualTo(BigDecimal.valueOf(175));
        verify(transactionRepository).save(any(Transaction.class));
        verify(walletRepository).save(wallet);
    }

    @Test
    @DisplayName("getTransactions returns paginated history")
    void getTransactions_success() {
        Transaction transaction = Transaction.builder()
                .id(5L)
                .wallet(wallet)
                .type(Transaction.Type.DEPOSIT)
                .amount(BigDecimal.valueOf(25))
                .build();

        Page<Transaction> page = new PageImpl<>(List.of(transaction));
        when(walletRepository.findByUserId(user.getId())).thenReturn(Optional.of(wallet));
        when(transactionRepository.findByWalletIdOrderByCreatedAtDesc(eq(wallet.getId()), any()))
                .thenReturn(page);

        Page<TransactionResponse> result = walletService.getTransactions(user, PageRequest.of(0, 10));

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getType()).isEqualTo("DEPOSIT");
    }
}
