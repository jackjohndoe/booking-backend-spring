package com.example.booking.service.impl;

import com.example.booking.dto.wallet.DepositRequest;
import com.example.booking.dto.wallet.TransactionResponse;
import com.example.booking.dto.wallet.WalletResponse;
import com.example.booking.dto.wallet.WithdrawalRequest;
import com.example.booking.entity.Booking;
import com.example.booking.entity.Transaction;
import com.example.booking.entity.User;
import com.example.booking.entity.Wallet;
import com.example.booking.exception.BadRequestException;
import com.example.booking.exception.ResourceNotFoundException;
import com.example.booking.payment.PaymentProvider;
import com.example.booking.payment.dto.PaymentIntentRequest;
import com.example.booking.payment.dto.PaymentIntentResponse;
import com.example.booking.payment.dto.PayoutRequest;
import com.example.booking.repository.BookingRepository;
import com.example.booking.repository.TransactionRepository;
import com.example.booking.repository.WalletRepository;
import com.example.booking.service.WalletService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Service
@Transactional
public class WalletServiceImpl implements WalletService {

    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;
    private final BookingRepository bookingRepository;
    private final PaymentProvider paymentProvider;

    public WalletServiceImpl(WalletRepository walletRepository,
                             TransactionRepository transactionRepository,
                             BookingRepository bookingRepository,
                             PaymentProvider paymentProvider) {
        this.walletRepository = walletRepository;
        this.transactionRepository = transactionRepository;
        this.bookingRepository = bookingRepository;
        this.paymentProvider = paymentProvider;
    }

    @Override
    public WalletResponse getOrCreateWallet(User user) {
        Wallet wallet = walletRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    Wallet newWallet = Wallet.builder()
                            .user(user)
                            .balance(BigDecimal.ZERO)
                            .currency("USD")
                            .status(Wallet.Status.ACTIVE)
                            .build();
                    return walletRepository.save(newWallet);
                });
        return toResponse(wallet);
    }

    @Override
    @Transactional(readOnly = true)
    public WalletResponse getWallet(User user) {
        Wallet wallet = walletRepository.findByUserId(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found for your account. " +
                        "Please contact support if you believe this is an error."));
        return toResponse(wallet);
    }

    @Override
    public TransactionResponse deposit(DepositRequest request, User user) {
        Wallet wallet = walletRepository.findByUserIdWithLock(user.getId())
                .orElseGet(() -> {
                    Wallet newWallet = Wallet.builder()
                            .user(user)
                            .balance(BigDecimal.ZERO)
                            .currency("USD")
                            .status(Wallet.Status.ACTIVE)
                            .build();
                    return walletRepository.save(newWallet);
                });

        PaymentIntentRequest paymentRequest = PaymentIntentRequest.builder()
                .amount(request.getAmount())
                .currency(wallet.getCurrency())
                .customerId(user.getId().toString())
                .description(request.getDescription() != null ? request.getDescription() : "Wallet deposit")
                .captureImmediately(true)
                .build();

        PaymentIntentResponse paymentResponse = paymentProvider.createPaymentIntent(paymentRequest);
        PaymentIntentResponse confirmed = paymentProvider.confirmPaymentIntent(paymentResponse.getPaymentIntentId());

        if (!"succeeded".equals(confirmed.getStatus())) {
            String reason = confirmed.getFailureReason() != null ? confirmed.getFailureReason() : "Unknown error";
            throw new BadRequestException("Payment processing failed: " + reason + 
                    ". Please check your payment method and try again, or contact support if the issue persists.");
        }

        Transaction transaction = Transaction.builder()
                .wallet(wallet)
                .user(user)
                .type(Transaction.Type.DEPOSIT)
                .status(Transaction.Status.COMPLETED)
                .amount(request.getAmount())
                .currency(wallet.getCurrency())
                .description(request.getDescription())
                .externalPaymentId(confirmed.getPaymentIntentId())
                .reference("DEP_" + System.currentTimeMillis())
                .build();

        transaction.setProcessedAt(java.time.OffsetDateTime.now());
        Transaction saved = transactionRepository.save(transaction);

        wallet.setBalance(wallet.getBalance().add(request.getAmount()));
        walletRepository.save(wallet);

        return toTransactionResponse(saved);
    }

    @Override
    public TransactionResponse withdraw(WithdrawalRequest request, User user) {
        Wallet wallet = walletRepository.findByUserIdWithLock(user.getId())
                .orElseThrow(() -> new ResourceNotFoundException("Wallet not found for your account. " +
                        "Please contact support if you believe this is an error."));

        if (wallet.getBalance().compareTo(request.getAmount()) < 0) {
            throw new BadRequestException("Insufficient wallet balance. Your current balance is " + 
                    wallet.getBalance() + " " + wallet.getCurrency() + ", but you attempted to withdraw " + 
                    request.getAmount() + " " + wallet.getCurrency() + ". Please deposit funds or adjust the withdrawal amount.");
        }

        PayoutRequest payoutRequest = PayoutRequest.builder()
                .amount(request.getAmount())
                .currency(wallet.getCurrency())
                .destinationAccountId(request.getDestinationAccountId())
                .description(request.getDescription() != null ? request.getDescription() : "Wallet withdrawal")
                .build();

        var payoutResponse = paymentProvider.createPayout(payoutRequest);

        Transaction transaction = Transaction.builder()
                .wallet(wallet)
                .user(user)
                .type(Transaction.Type.WITHDRAWAL)
                .status("pending".equals(payoutResponse.getStatus()) ? Transaction.Status.PROCESSING : Transaction.Status.COMPLETED)
                .amount(request.getAmount())
                .currency(wallet.getCurrency())
                .description(request.getDescription())
                .externalPayoutId(payoutResponse.getPayoutId())
                .reference("WTH_" + System.currentTimeMillis())
                .build();

        if (Transaction.Status.COMPLETED.equals(transaction.getStatus())) {
            transaction.setProcessedAt(java.time.OffsetDateTime.now());
            wallet.setBalance(wallet.getBalance().subtract(request.getAmount()));
        }

        Transaction saved = transactionRepository.save(transaction);
        walletRepository.save(wallet);

        return toTransactionResponse(saved);
    }

    @Override
    @Transactional(readOnly = true)
    public Page<TransactionResponse> getTransactions(User user, Pageable pageable) {
        Wallet wallet = walletRepository.findByUserId(user.getId()).orElse(null);
        if (wallet == null) {
            return Page.empty(pageable);
        }
        return transactionRepository.findByWalletIdOrderByCreatedAtDesc(wallet.getId(), pageable)
                .map(this::toTransactionResponse);
    }

    @Override
    public void processEscrowHold(Long bookingId, BigDecimal amount, User user) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found with ID: " + bookingId + 
                        ". The booking may have been cancelled or deleted, or the ID may be incorrect."));

        Wallet wallet = walletRepository.findByUserIdWithLock(user.getId()).orElse(null);
        boolean isWalletPayment = wallet != null;

        if (isWalletPayment) {
            if (wallet.getBalance().compareTo(amount) < 0) {
                throw new BadRequestException("Insufficient wallet balance for escrow. Your current balance is " + 
                        wallet.getBalance() + " " + wallet.getCurrency() + ", but the booking requires " + 
                        amount + " " + wallet.getCurrency() + ". Please deposit funds to your wallet or use a different payment method.");
            }
            wallet.setBalance(wallet.getBalance().subtract(amount));
            walletRepository.save(wallet);
        }

        Transaction transaction = Transaction.builder()
                .wallet(wallet)
                .user(user)
                .booking(booking)
                .type(Transaction.Type.ESCROW_HOLD)
                .status(Transaction.Status.COMPLETED)
                .amount(amount)
                .currency(isWalletPayment ? wallet.getCurrency() : "USD")
                .description("Escrow hold for booking #" + bookingId)
                .reference("ESC_HOLD_" + bookingId)
                .build();

        transaction.setProcessedAt(java.time.OffsetDateTime.now());
        transactionRepository.save(transaction);
    }

    @Override
    public void processEscrowRelease(Long bookingId, User host) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found with ID: " + bookingId + 
                        ". The booking may have been cancelled or deleted, or the ID may be incorrect."));

        Transaction escrowHold = transactionRepository.findByBookingIdAndType(bookingId, Transaction.Type.ESCROW_HOLD)
                .orElseThrow(() -> new BadRequestException("Escrow hold not found for booking ID: " + bookingId + 
                        ". The payment may not have been processed yet, or the booking may not have an active escrow hold."));

        Wallet hostWallet = walletRepository.findByUserIdWithLock(host.getId())
                .orElseGet(() -> {
                    Wallet newWallet = Wallet.builder()
                            .user(host)
                            .balance(BigDecimal.ZERO)
                            .currency("USD")
                            .status(Wallet.Status.ACTIVE)
                            .build();
                    return walletRepository.save(newWallet);
                });

        BigDecimal platformFee = escrowHold.getAmount().multiply(new BigDecimal("0.10"));
        BigDecimal hostAmount = escrowHold.getAmount().subtract(platformFee);

        Transaction releaseTransaction = Transaction.builder()
                .wallet(hostWallet)
                .user(host)
                .booking(booking)
                .type(Transaction.Type.ESCROW_RELEASE)
                .status(Transaction.Status.COMPLETED)
                .amount(hostAmount)
                .currency(hostWallet.getCurrency())
                .description("Escrow release for booking #" + bookingId)
                .reference("ESC_RELEASE_" + bookingId)
                .build();

        releaseTransaction.setProcessedAt(java.time.OffsetDateTime.now());
        transactionRepository.save(releaseTransaction);

        Transaction feeTransaction = Transaction.builder()
                .wallet(hostWallet)
                .user(host)
                .booking(booking)
                .type(Transaction.Type.PLATFORM_FEE)
                .status(Transaction.Status.COMPLETED)
                .amount(platformFee.negate())
                .currency(hostWallet.getCurrency())
                .description("Platform fee for booking #" + bookingId)
                .reference("FEE_" + bookingId)
                .build();

        feeTransaction.setProcessedAt(java.time.OffsetDateTime.now());
        transactionRepository.save(feeTransaction);

        hostWallet.setBalance(hostWallet.getBalance().add(hostAmount));
        walletRepository.save(hostWallet);
    }

    @Override
    public void processRefund(Long bookingId, String reason) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResourceNotFoundException("Booking not found with ID: " + bookingId + 
                        ". The booking may have been cancelled or deleted, or the ID may be incorrect."));

        Transaction escrowHold = transactionRepository.findByBookingIdAndType(bookingId, Transaction.Type.ESCROW_HOLD)
                .orElse(null);

        if (escrowHold == null) {
            return;
        }

        boolean isWalletPayment = escrowHold.getWallet() != null;
        Wallet userWallet = null;

        if (isWalletPayment) {
            userWallet = walletRepository.findByUserIdWithLock(booking.getUser().getId())
                    .orElseGet(() -> {
                        Wallet newWallet = Wallet.builder()
                                .user(booking.getUser())
                                .balance(BigDecimal.ZERO)
                                .currency("USD")
                                .status(Wallet.Status.ACTIVE)
                                .build();
                        return walletRepository.save(newWallet);
                    });
        }

        Transaction refundTransaction = Transaction.builder()
                .wallet(userWallet)
                .user(booking.getUser())
                .booking(booking)
                .type(Transaction.Type.BOOKING_REFUND)
                .status(Transaction.Status.COMPLETED)
                .amount(escrowHold.getAmount())
                .currency(isWalletPayment ? userWallet.getCurrency() : escrowHold.getCurrency())
                .description("Refund for booking #" + bookingId + (reason != null ? ": " + reason : ""))
                .reference("REFUND_" + bookingId)
                .externalPaymentId(escrowHold.getExternalPaymentId())
                .build();

        refundTransaction.setProcessedAt(java.time.OffsetDateTime.now());
        transactionRepository.save(refundTransaction);

        if (isWalletPayment && userWallet != null) {
            userWallet.setBalance(userWallet.getBalance().add(escrowHold.getAmount()));
            walletRepository.save(userWallet);
        }
    }

    @Override
    public TransactionResponse requestPayout(WithdrawalRequest request, User user) {
        return withdraw(request, user);
    }

    private WalletResponse toResponse(Wallet wallet) {
        return WalletResponse.builder()
                .id(wallet.getId())
                .userId(wallet.getUser().getId())
                .balance(wallet.getBalance())
                .currency(wallet.getCurrency())
                .status(wallet.getStatus().name())
                .createdAt(wallet.getCreatedAt())
                .build();
    }

    private TransactionResponse toTransactionResponse(Transaction transaction) {
        return TransactionResponse.builder()
                .id(transaction.getId())
                .walletId(transaction.getWallet() != null ? transaction.getWallet().getId() : null)
                .userId(transaction.getUser().getId())
                .bookingId(transaction.getBooking() != null ? transaction.getBooking().getId() : null)
                .type(transaction.getType().name())
                .status(transaction.getStatus().name())
                .amount(transaction.getAmount())
                .currency(transaction.getCurrency())
                .description(transaction.getDescription())
                .reference(transaction.getReference())
                .createdAt(transaction.getCreatedAt())
                .processedAt(transaction.getProcessedAt())
                .build();
    }
}
