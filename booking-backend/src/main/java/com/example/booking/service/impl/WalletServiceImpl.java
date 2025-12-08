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
import com.example.booking.payment.FlutterwaveService;
import com.example.booking.payment.dto.PaymentIntentRequest;
import com.example.booking.payment.dto.PaymentIntentResponse;
import com.example.booking.payment.dto.PayoutRequest;
import com.example.booking.repository.BookingRepository;
import com.example.booking.repository.TransactionRepository;
import com.example.booking.repository.UserRepository;
import com.example.booking.repository.WalletRepository;
import com.example.booking.service.WalletService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import lombok.extern.slf4j.Slf4j;

import java.math.BigDecimal;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

@Slf4j
@Service
@Transactional
public class WalletServiceImpl implements WalletService {

    private final WalletRepository walletRepository;
    private final TransactionRepository transactionRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final PaymentProvider paymentProvider;
    private final FlutterwaveService flutterwaveService;

    public WalletServiceImpl(WalletRepository walletRepository,
                             TransactionRepository transactionRepository,
                             BookingRepository bookingRepository,
                             UserRepository userRepository,
                             PaymentProvider paymentProvider,
                             FlutterwaveService flutterwaveService) {
        this.walletRepository = walletRepository;
        this.transactionRepository = transactionRepository;
        this.bookingRepository = bookingRepository;
        this.userRepository = userRepository;
        this.paymentProvider = paymentProvider;
        this.flutterwaveService = flutterwaveService;
    }

    @Override
    public WalletResponse getOrCreateWallet(User user) {
        Wallet wallet = walletRepository.findByUserId(user.getId())
                .orElseGet(() -> {
                    Wallet newWallet = Wallet.builder()
                            .user(user)
                            .balance(BigDecimal.ZERO) // Initial balance, will be synced immediately
                            .currency("NGN")
                            .status(Wallet.Status.ACTIVE)
                            .build();
                    Wallet saved = walletRepository.save(newWallet);
                    
                    // Immediately sync balance to ensure it reflects all existing transactions
                    // This is critical - even if wallet is new, there might be existing transactions
                    try {
                        syncBalanceWithFlutterwave(user);
                        // Refresh wallet after sync to get correct balance
                        return walletRepository.findByUserId(user.getId()).orElse(saved);
                    } catch (Exception e) {
                        log.warn("Failed to sync balance for newly created wallet for user {}: {}", user.getId(), e.getMessage());
                        return saved;
                    }
                });
        
        // Always sync balance to ensure it reflects the sum of ALL transactions
        // This ensures balance is never stale or incorrect
        // Sync if it hasn't been synced recently (within last 30 seconds)
        if (wallet.getLastSyncedAt() == null || 
            wallet.getLastSyncedAt().isBefore(java.time.OffsetDateTime.now().minusSeconds(30))) {
            try {
                syncBalanceWithFlutterwave(user);
                // Refresh wallet after sync to get correct balance
                wallet = walletRepository.findByUserId(user.getId()).orElse(wallet);
            } catch (Exception e) {
                log.warn("Failed to sync balance when retrieving wallet for user {}: {}", user.getId(), e.getMessage());
                // Continue with existing balance if sync fails, but log the issue
            }
        }
        
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
        // For Flutterwave integration, deposits are processed via webhook
        // This method creates a pending transaction that will be confirmed by webhook
        Wallet wallet = walletRepository.findByUserIdWithLock(user.getId())
                .orElseGet(() -> {
                    Wallet newWallet = Wallet.builder()
                            .user(user)
                            .balance(BigDecimal.ZERO)
                            .currency("NGN")
                            .status(Wallet.Status.ACTIVE)
                            .build();
                    return walletRepository.save(newWallet);
                });

        // Create pending transaction - will be confirmed when Flutterwave webhook arrives
        String reference = request.getReference() != null ? request.getReference() : 
                "DEP_" + System.currentTimeMillis() + "_" + user.getId();
        
        Transaction transaction = Transaction.builder()
                .wallet(wallet)
                .user(user)
                .type(Transaction.Type.DEPOSIT)
                .status(Transaction.Status.PENDING) // Will be updated by webhook
                .amount(request.getAmount())
                .currency("NGN")
                .description(request.getDescription() != null ? request.getDescription() : "Wallet deposit")
                .reference(reference)
                .flutterwaveTxRef(request.getReference()) // Store Flutterwave tx_ref
                .build();

        Transaction saved = transactionRepository.save(transaction);
        
        // If Flutterwave reference is provided, try to verify immediately
        if (request.getReference() != null && !request.getReference().isEmpty()) {
            try {
                FlutterwaveService.TransactionVerification verification = 
                        flutterwaveService.verifyTransaction(request.getReference());
                if ("successful".equalsIgnoreCase(verification.getStatus())) {
                    // Payment already confirmed, update transaction
                    saved.setStatus(Transaction.Status.COMPLETED);
                    saved.setFlutterwaveFlwRef(verification.getFlwRef());
                    saved.setFlutterwaveStatus(verification.getStatus());
                    saved.setProcessedAt(java.time.OffsetDateTime.now());
                    transactionRepository.save(saved);
                    // Recalculate balance from all transactions instead of incremental update
                    syncBalanceWithFlutterwave(user);
                }
            } catch (Exception e) {
                // Verification failed, transaction remains pending - webhook will update it
                log.warn("Could not verify Flutterwave transaction immediately: {}", e.getMessage());
            }
        }

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

        // Use Flutterwave Transfer API to send money to user's bank account
        String reference = "WTH_" + System.currentTimeMillis() + "_" + user.getId();
        String accountBank = request.getAccountBank() != null ? request.getAccountBank() : 
                extractBankCode(request.getDestinationAccountId());
        String accountNumber = request.getAccountNumber() != null ? request.getAccountNumber() : 
                extractAccountNumber(request.getDestinationAccountId());
        String beneficiaryName = request.getBeneficiaryName() != null ? request.getBeneficiaryName() : 
                user.getName();

        try {
            FlutterwaveService.TransferResponse transferResponse = flutterwaveService.transferFunds(
                    accountBank,
                    accountNumber,
                    request.getAmount(),
                    request.getDescription() != null ? request.getDescription() : "Wallet withdrawal",
                    reference,
                    beneficiaryName
            );

            // Create transaction with processing status - will be confirmed by webhook
            // CRITICAL: Ensure transaction has proper reference in all fields for reliable tracking
            String transferId = transferResponse.getTransferId();
            
            Transaction transaction = Transaction.builder()
                    .wallet(wallet)
                    .user(user)
                    .type(Transaction.Type.WITHDRAWAL)
                    .status(Transaction.Status.PROCESSING) // Will be updated by webhook
                    .amount(request.getAmount())
                    .currency("NGN")
                    .description(request.getDescription())
                    // Store reference in multiple fields for reliable matching
                    .reference(reference) // Primary reference field
                    .flutterwaveTransferId(transferId) // Flutterwave transfer ID
                    .flutterwaveStatus(transferResponse.getStatus())
                    .createdAt(java.time.OffsetDateTime.now())
                    .build();

            // Create transaction first, then recalculate balance from all transactions
            Transaction saved = transactionRepository.save(transaction);
            // Recalculate balance from all transactions instead of incremental update
            syncBalanceWithFlutterwave(user);

            return toTransactionResponse(saved);
        } catch (Exception e) {
            log.error("Flutterwave transfer failed for withdrawal", e);
            throw new BadRequestException("Withdrawal failed: " + e.getMessage() + 
                    ". Please check your bank account details and try again.");
        }
    }

    private String extractBankCode(String destinationAccountId) {
        // Extract bank code from destination account ID if in format "BANK_CODE:ACCOUNT_NUMBER"
        if (destinationAccountId != null && destinationAccountId.contains(":")) {
            return destinationAccountId.split(":")[0];
        }
        return null;
    }

    private String extractAccountNumber(String destinationAccountId) {
        // Extract account number from destination account ID if in format "BANK_CODE:ACCOUNT_NUMBER"
        if (destinationAccountId != null && destinationAccountId.contains(":")) {
            return destinationAccountId.split(":")[1];
        }
        return destinationAccountId;
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
            // Sync balance first to get accurate current balance
            syncBalanceWithFlutterwave(user);
            wallet = walletRepository.findByUserId(user.getId()).orElse(wallet);
            if (wallet.getBalance().compareTo(amount) < 0) {
                throw new BadRequestException("Insufficient wallet balance for escrow. Your current balance is " + 
                        wallet.getBalance() + " " + wallet.getCurrency() + ", but the booking requires " + 
                        amount + " " + wallet.getCurrency() + ". Please deposit funds to your wallet or use a different payment method.");
            }
        }

        Transaction transaction = Transaction.builder()
                .wallet(wallet)
                .user(user)
                .booking(booking)
                .type(Transaction.Type.ESCROW_HOLD)
                .status(Transaction.Status.COMPLETED)
                .amount(amount)
                .currency(isWalletPayment ? wallet.getCurrency() : "NGN")
                .description("Escrow hold for booking #" + bookingId)
                .reference("ESC_HOLD_" + bookingId)
                .build();

        transaction.setProcessedAt(java.time.OffsetDateTime.now());
        transactionRepository.save(transaction);
        
        // Recalculate balance from all transactions instead of incremental update
        if (isWalletPayment) {
            syncBalanceWithFlutterwave(user);
        }
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
                            .currency("NGN")
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

        // Recalculate balance from all transactions instead of incremental update
        syncBalanceWithFlutterwave(host);
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
                                .currency("NGN")
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

        // Recalculate balance from all transactions instead of incremental update
        if (isWalletPayment && userWallet != null) {
            syncBalanceWithFlutterwave(booking.getUser());
        }
    }

    @Override
    public TransactionResponse requestPayout(WithdrawalRequest request, User user) {
        return withdraw(request, user);
    }

    @Override
    public void processFlutterwaveWebhook(String event, String txRef, String flwRef, BigDecimal amount, String status, String customerEmail) {
        log.info("Processing Flutterwave webhook: event={}, txRef={}, flwRef={}, amount={}, status={}, customerEmail={}", 
                event, txRef, flwRef, amount, status, customerEmail);

        try {
            // Find transaction by Flutterwave reference
            Transaction transaction = transactionRepository.findByFlutterwaveTxRef(txRef)
                    .orElseGet(() -> transactionRepository.findByFlutterwaveFlwRef(flwRef).orElse(null));

            User user = null;
            Wallet wallet = null;

            // If transaction exists, get user and wallet from it
            if (transaction != null) {
                wallet = transaction.getWallet();
                if (wallet != null) {
                    user = wallet.getUser();
                } else {
                    log.warn("Transaction {} exists but has no associated wallet", transaction.getId());
                }
            }

            // If transaction doesn't exist, we need to create it
            // First, find or determine the user
            if (user == null) {
                // Try to find user by customer email from webhook
                if (customerEmail != null && !customerEmail.trim().isEmpty()) {
                    user = userRepository.findByEmail(customerEmail.trim().toLowerCase())
                            .orElse(null);
                    if (user != null) {
                        log.info("Found user by email from webhook: email={}, userId={}", customerEmail, user.getId());
                    }
                }

                // If still no user, try to extract email from txRef pattern
                // Pattern: wallet_topup_email_timestamp or email_timestamp_id
                if (user == null && txRef != null) {
                    try {
                        // Try patterns: wallet_topup_email_timestamp, email_timestamp_id
                        String[] parts = txRef.split("_");
                        for (int i = 0; i < parts.length; i++) {
                            String part = parts[i];
                            // Check if this part looks like an email (contains @)
                            if (part.contains("@")) {
                                // Try to reconstruct email (might be split across parts)
                                String potentialEmail = part;
                                if (i + 1 < parts.length && !parts[i + 1].matches("\\d+")) {
                                    // Next part might be part of email domain
                                    potentialEmail = part + "_" + parts[i + 1];
                                }
                                user = userRepository.findByEmail(potentialEmail.toLowerCase())
                                        .orElse(null);
                                if (user != null) {
                                    log.info("Found user by email extracted from txRef: email={}, userId={}", potentialEmail, user.getId());
                                    break;
                                }
                            }
                        }
                    } catch (Exception e) {
                        log.debug("Could not extract email from txRef: {}", e.getMessage());
                    }
                }

                // If still no user, verify transaction with Flutterwave to get customer email
                if (user == null && customerEmail == null) {
                    try {
                        log.info("Attempting to verify transaction with Flutterwave to get customer email: txRef={}", txRef);
                        FlutterwaveService.TransactionVerification verification = flutterwaveService.verifyTransaction(txRef);
                        if (verification != null && verification.getTxRef() != null) {
                            String verifiedEmail = verification.getCustomerEmail();
                            if (verifiedEmail != null && !verifiedEmail.trim().isEmpty()) {
                                user = userRepository.findByEmail(verifiedEmail.trim().toLowerCase())
                                        .orElse(null);
                                if (user != null) {
                                    log.info("Found user by email from Flutterwave verification: email={}, userId={}", verifiedEmail, user.getId());
                                } else {
                                    log.warn("Customer email from Flutterwave verification doesn't match any user: email={}", verifiedEmail);
                                }
                            } else {
                                log.debug("Transaction verified but customer email not available in verification response");
                            }
                        }
                    } catch (Exception e) {
                        log.debug("Could not verify transaction to get customer email: {}", e.getMessage());
                    }
                }

                // If we still don't have a user, we can't process the webhook
                if (user == null) {
                    log.error("Cannot process webhook: Unable to determine user for txRef={}, flwRef={}, customerEmail={}. " +
                            "Transaction will be created on next sync when user is identified.", txRef, flwRef, customerEmail);
                    return;
                }
            }

            // Create final reference for lambda expression
            final User finalUser = user;

            // Get or create wallet for user
            if (wallet == null) {
                wallet = walletRepository.findByUserId(finalUser.getId())
                        .orElseGet(() -> {
                            Wallet newWallet = Wallet.builder()
                                    .user(finalUser)
                                    .balance(BigDecimal.ZERO)
                                    .currency("NGN")
                                    .status(Wallet.Status.ACTIVE)
                                    .build();
                            return walletRepository.save(newWallet);
                        });
                log.info("Retrieved or created wallet for user: userId={}, walletId={}", user.getId(), wallet.getId());
            }

            // If transaction doesn't exist, create it now
            if (transaction == null) {
                log.info("Creating new transaction from webhook: txRef={}, flwRef={}, amount={}, userId={}", 
                        txRef, flwRef, amount, user.getId());
                
                // CRITICAL: Ensure transaction has proper reference in all fields for reliable tracking
                transaction = Transaction.builder()
                        .wallet(wallet)
                        .user(user)
                        .type(Transaction.Type.DEPOSIT)
                        .status(Transaction.Status.PENDING)
                        .amount(amount)
                        .currency("NGN")
                        .description("Wallet Top-up via Flutterwave")
                        // Store reference in multiple fields for reliable matching
                        .reference(txRef) // Primary reference field
                        .flutterwaveTxRef(txRef) // Flutterwave transaction reference
                        .flutterwaveFlwRef(flwRef) // Flutterwave flw reference
                        .flutterwaveStatus(status)
                        .createdAt(java.time.OffsetDateTime.now())
                        .build();
                
                transaction = transactionRepository.save(transaction);
                log.info("✅ Created new transaction from webhook: transactionId={}, txRef={}, flwRef={}", 
                        transaction.getId(), txRef, flwRef);
            }

            boolean isSuccessful = "successful".equalsIgnoreCase(status) || 
                                  "SUCCESSFUL".equalsIgnoreCase(status) ||
                                  "completed".equalsIgnoreCase(status) ||
                                  "COMPLETED".equalsIgnoreCase(status);

            if ("charge.completed".equals(event)) {
                // Deposit completed - credit wallet
                if (isSuccessful) {
                    // Process transaction regardless of current status to ensure it's always updated
                    // This handles cases where webhook arrives before initial transaction creation
                    boolean wasPending = transaction.getStatus() == Transaction.Status.PENDING || 
                                       transaction.getStatus() == Transaction.Status.PROCESSING;
                    
                    if (wasPending || transaction.getStatus() != Transaction.Status.COMPLETED) {
                        BigDecimal oldBalance = wallet.getBalance();
                        transaction.setStatus(Transaction.Status.COMPLETED);
                        
                        // CRITICAL: Update all reference fields to ensure proper tracking
                        if (txRef != null && (transaction.getReference() == null || transaction.getReference().isEmpty())) {
                            transaction.setReference(txRef);
                        }
                        if (txRef != null && (transaction.getFlutterwaveTxRef() == null || !transaction.getFlutterwaveTxRef().equals(txRef))) {
                            transaction.setFlutterwaveTxRef(txRef);
                        }
                        if (flwRef != null) {
                            transaction.setFlutterwaveFlwRef(flwRef);
                        }
                        transaction.setFlutterwaveStatus(status);
                        transaction.setProcessedAt(java.time.OffsetDateTime.now());
                        transactionRepository.save(transaction);
                        
                        // Recalculate balance from all transactions instead of incremental update
                        // This ensures balance always reflects the sum of all transactions
                        syncBalanceWithFlutterwave(wallet.getUser());
                        wallet = walletRepository.findByUserId(wallet.getUser().getId()).orElse(wallet);
                        log.info("✅ Wallet credited via webhook (REAL-TIME): userId={}, amount={}, oldBalance={}, newBalance={}, txRef={}, flwRef={}", 
                                wallet.getUser().getId(), amount, oldBalance, wallet.getBalance(), txRef, flwRef);
                    } else {
                        // Even if already completed, update references if missing
                        boolean referenceUpdated = false;
                        if (txRef != null && (transaction.getReference() == null || transaction.getReference().isEmpty())) {
                            transaction.setReference(txRef);
                            referenceUpdated = true;
                        }
                        if (txRef != null && (transaction.getFlutterwaveTxRef() == null || !transaction.getFlutterwaveTxRef().equals(txRef))) {
                            transaction.setFlutterwaveTxRef(txRef);
                            referenceUpdated = true;
                        }
                        if (flwRef != null && (transaction.getFlutterwaveFlwRef() == null || !transaction.getFlutterwaveFlwRef().equals(flwRef))) {
                            transaction.setFlutterwaveFlwRef(flwRef);
                            referenceUpdated = true;
                        }
                        if (referenceUpdated) {
                            transactionRepository.save(transaction);
                            log.info("✅ Updated transaction references: txRef={}, flwRef={}", txRef, flwRef);
                        } else {
                            log.debug("Transaction {} already completed with all references, skipping duplicate processing", transaction.getId());
                        }
                    }
                } else if (!isSuccessful) {
                    transaction.setStatus(Transaction.Status.FAILED);
                    transaction.setFlutterwaveStatus(status);
                    transaction.setProcessedAt(java.time.OffsetDateTime.now());
                    // Ensure references are set even for failed transactions
                    if (txRef != null && (transaction.getReference() == null || transaction.getReference().isEmpty())) {
                        transaction.setReference(txRef);
                    }
                    if (txRef != null && (transaction.getFlutterwaveTxRef() == null || !transaction.getFlutterwaveTxRef().equals(txRef))) {
                        transaction.setFlutterwaveTxRef(txRef);
                    }
                    transactionRepository.save(transaction);
                    log.warn("Deposit failed via webhook: txRef={}, status={}", txRef, status);
                }
            } else if ("transfer.completed".equals(event)) {
                // Transfer completed - already deducted, just update status
                if (isSuccessful && (transaction.getStatus() == Transaction.Status.PROCESSING ||
                                    transaction.getStatus() == Transaction.Status.PENDING)) {
                    transaction.setStatus(Transaction.Status.COMPLETED);
                    transaction.setFlutterwaveTransferId(flwRef);
                    transaction.setFlutterwaveStatus(status);
                    transaction.setProcessedAt(java.time.OffsetDateTime.now());
                    wallet.setLastSyncedAt(java.time.OffsetDateTime.now());
                    transactionRepository.save(transaction);
                    walletRepository.save(wallet);
                    log.info("Withdrawal completed via webhook: userId={}, amount={}, newBalance={}", 
                            wallet.getUser().getId(), amount, wallet.getBalance());
                } else if (!isSuccessful) {
                    // Transfer failed - refund wallet
                    BigDecimal oldBalance = wallet.getBalance();
                    transaction.setStatus(Transaction.Status.FAILED);
                    transaction.setFlutterwaveStatus(status);
                    transaction.setProcessedAt(java.time.OffsetDateTime.now());
                    transactionRepository.save(transaction);
                    // Recalculate balance from all transactions instead of incremental update
                    syncBalanceWithFlutterwave(wallet.getUser());
                    wallet = walletRepository.findByUserId(wallet.getUser().getId()).orElse(wallet);
                    log.warn("Withdrawal failed via webhook, refunded: txRef={}, status={}, oldBalance={}, newBalance={}", 
                            txRef, status, oldBalance, wallet.getBalance());
                } else {
                    log.info("Transaction {} already processed with status {}", transaction.getId(), transaction.getStatus());
                }
            }
        } catch (Exception e) {
            log.error("Error processing Flutterwave webhook: event={}, txRef={}, flwRef={}", 
                    event, txRef, flwRef, e);
            throw e; // Re-throw to be handled by controller
        }
    }

    @Override
    public void syncBalanceWithFlutterwave(User user) {
        try {
            Wallet wallet = walletRepository.findByUserId(user.getId()).orElse(null);
            if (wallet == null) {
                log.warn("No wallet found for user {}", user.getId());
                return;
            }

            // Get all transactions for this wallet to verify calculation
            java.util.List<Transaction> allTransactions = transactionRepository.findByWalletIdOrderByCreatedAtDesc(
                    wallet.getId(), org.springframework.data.domain.PageRequest.of(0, 1000))
                    .getContent();
            
            log.debug("Found {} total transactions for wallet {}", allTransactions.size(), wallet.getId());

            // Recalculate balance from ALL completed transactions
            // This ensures balance reflects the sum of all money added minus all money withdrawn
            BigDecimal deposits = transactionRepository.sumAmountByWalletAndTypes(
                    wallet.getId(),
                    java.util.Arrays.asList(
                            Transaction.Type.DEPOSIT,
                            Transaction.Type.ESCROW_RELEASE,
                            Transaction.Type.BOOKING_REFUND
                    )
            );
            if (deposits == null) {
                deposits = BigDecimal.ZERO;
            }

            BigDecimal withdrawals = transactionRepository.sumAmountByWalletAndTypes(
                    wallet.getId(),
                    java.util.Arrays.asList(
                            Transaction.Type.WITHDRAWAL,
                            Transaction.Type.ESCROW_HOLD,
                            Transaction.Type.BOOKING_PAYMENT
                    )
            );
            if (withdrawals == null) {
                withdrawals = BigDecimal.ZERO;
            }

            // Calculate balance: deposits - withdrawals
            // This represents the sum of all money user has added minus all money withdrawn
            BigDecimal calculatedBalance = deposits.subtract(withdrawals);
            
            // Log detailed calculation for debugging
            log.info("Balance calculation for user {}: deposits={}, withdrawals={}, calculatedBalance={}", 
                    user.getId(), deposits, withdrawals, calculatedBalance);
            
            // Count completed transactions for logging
            long completedDeposits = allTransactions.stream()
                    .filter(t -> (t.getType() == Transaction.Type.DEPOSIT || 
                                 t.getType() == Transaction.Type.ESCROW_RELEASE || 
                                 t.getType() == Transaction.Type.BOOKING_REFUND) &&
                                t.getStatus() == Transaction.Status.COMPLETED)
                    .count();
            long completedWithdrawals = allTransactions.stream()
                    .filter(t -> (t.getType() == Transaction.Type.WITHDRAWAL || 
                                 t.getType() == Transaction.Type.ESCROW_HOLD || 
                                 t.getType() == Transaction.Type.BOOKING_PAYMENT) &&
                                t.getStatus() == Transaction.Status.COMPLETED)
                    .count();
            
            log.debug("Completed transactions: {} deposits, {} withdrawals", completedDeposits, completedWithdrawals);
            
            // Ensure balance is not negative (shouldn't happen, but safety check)
            // However, we should allow negative if user has pending withdrawals that exceed balance
            // For now, we'll log a warning but keep the calculated balance
            if (calculatedBalance.compareTo(BigDecimal.ZERO) < 0) {
                log.warn("Calculated balance is negative for user {}: {}. This may indicate pending transactions.", 
                        user.getId(), calculatedBalance);
                // Don't set to zero - keep the actual calculated balance
            }

            // Always update balance to reflect the sum of all transactions
            // This ensures balance is never reset to 0 if there are existing transactions
            BigDecimal oldBalance = wallet.getBalance();
            wallet.setBalance(calculatedBalance);
            wallet.setLastSyncedAt(java.time.OffsetDateTime.now());
            walletRepository.save(wallet);
            
            if (!oldBalance.equals(calculatedBalance)) {
                log.info("Balance updated for user {}: oldBalance={}, newBalance={}", 
                        user.getId(), oldBalance, calculatedBalance);
            } else {
                log.debug("Balance unchanged for user {}: {}", user.getId(), calculatedBalance);
            }
        } catch (Exception e) {
            log.error("Error syncing balance for user {}: {}", user.getId(), e.getMessage(), e);
            throw new RuntimeException("Failed to sync wallet balance: " + e.getMessage(), e);
        }
    }

    @Override
    public TransactionResponse verifyAndProcessTransaction(String txRef, User user) {
        try {
            log.info("Verifying and processing transaction: txRef={}, userId={}", txRef, user.getId());
            
            // Check if transaction already exists
            Transaction existingTransaction = transactionRepository.findByFlutterwaveTxRef(txRef).orElse(null);
            
            // Verify transaction with Flutterwave
            FlutterwaveService.TransactionVerification verification = flutterwaveService.verifyTransaction(txRef);
            
            if (verification == null || verification.getStatus() == null) {
                throw new RuntimeException("Transaction verification failed: No response from Flutterwave");
            }
            
            boolean isSuccessful = "successful".equalsIgnoreCase(verification.getStatus()) || 
                                  "SUCCESSFUL".equalsIgnoreCase(verification.getStatus()) ||
                                  "completed".equalsIgnoreCase(verification.getStatus()) ||
                                  "COMPLETED".equalsIgnoreCase(verification.getStatus());
            
            if (!isSuccessful) {
                log.warn("Transaction {} is not successful. Status: {}", txRef, verification.getStatus());
                if (existingTransaction != null) {
                    existingTransaction.setStatus(Transaction.Status.FAILED);
                    existingTransaction.setFlutterwaveStatus(verification.getStatus());
                    transactionRepository.save(existingTransaction);
                    return toTransactionResponse(existingTransaction);
                }
                throw new RuntimeException("Transaction is not successful. Status: " + verification.getStatus());
            }
            
            // Get or create wallet
            Wallet wallet = walletRepository.findByUserIdWithLock(user.getId())
                    .orElseGet(() -> {
                        Wallet newWallet = Wallet.builder()
                                .user(user)
                                .balance(BigDecimal.ZERO)
                                .currency("NGN")
                                .status(Wallet.Status.ACTIVE)
                                .build();
                        return walletRepository.save(newWallet);
                    });
            
            // CRITICAL: Use the charged amount (what customer paid), not settled amount
            // Flutterwave fees are deducted before settlement, but customer's wallet should reflect full amount paid
            BigDecimal amount = verification.getAmount() != null ? verification.getAmount() : BigDecimal.ZERO;
            log.info("Processing transaction - Amount from Flutterwave verification: NGN {} (this is the amount charged to customer, not settled amount), txRef: {}", 
                    amount, txRef);
            
            if (existingTransaction != null) {
                // Update existing transaction
                if (existingTransaction.getStatus() != Transaction.Status.COMPLETED) {
                BigDecimal oldBalance = wallet.getBalance();
                existingTransaction.setStatus(Transaction.Status.COMPLETED);
                existingTransaction.setFlutterwaveFlwRef(verification.getFlwRef());
                existingTransaction.setFlutterwaveStatus(verification.getStatus());
                existingTransaction.setProcessedAt(java.time.OffsetDateTime.now());
                transactionRepository.save(existingTransaction);
                // Recalculate balance from all transactions instead of incremental update
                syncBalanceWithFlutterwave(user);
                wallet = walletRepository.findByUserId(user.getId()).orElse(wallet);
                log.info("✅ Transaction updated and wallet credited with FULL charged amount: userId={}, amountCharged=NGN {}, oldBalance=NGN {}, newBalance=NGN {}, txRef={}", 
                        user.getId(), amount, oldBalance, wallet.getBalance(), txRef);
                } else {
                    log.info("Transaction {} already completed", txRef);
                }
                return toTransactionResponse(existingTransaction);
            } else {
                // Create new transaction
                // CRITICAL: Ensure transaction has proper reference in all fields for reliable tracking
                String flwRef = verification.getFlwRef();
                
                Transaction newTransaction = Transaction.builder()
                        .wallet(wallet)
                        .user(user)
                        .type(Transaction.Type.DEPOSIT)
                        .status(Transaction.Status.COMPLETED)
                        .amount(amount) // Full charged amount, not settled amount
                        .currency(verification.getCurrency() != null ? verification.getCurrency() : "NGN")
                        .description("Wallet deposit via Flutterwave")
                        // Store reference in multiple fields for reliable matching
                        .reference(txRef) // Primary reference field
                        .flutterwaveTxRef(txRef) // Flutterwave transaction reference
                        .flutterwaveFlwRef(flwRef) // Flutterwave flw reference
                        .flutterwaveStatus(verification.getStatus())
                        .processedAt(java.time.OffsetDateTime.now())
                        .createdAt(java.time.OffsetDateTime.now())
                        .build();
                
                BigDecimal oldBalance = wallet.getBalance();
                Transaction saved = transactionRepository.save(newTransaction);
                // Recalculate balance from all transactions instead of incremental update
                syncBalanceWithFlutterwave(user);
                wallet = walletRepository.findByUserId(user.getId()).orElse(wallet);
                log.info("✅ New transaction created and wallet credited with FULL charged amount: userId={}, amountCharged=NGN {}, oldBalance=NGN {}, newBalance=NGN {}, txRef={}", 
                        user.getId(), amount, oldBalance, wallet.getBalance(), txRef);
                return toTransactionResponse(saved);
            }
        } catch (Exception e) {
            log.error("Error verifying and processing transaction {} for user {}: {}", txRef, user.getId(), e.getMessage(), e);
            throw new RuntimeException("Failed to verify and process transaction: " + e.getMessage(), e);
        }
    }

    @Override
    public void syncAllTransactionsFromFlutterwave(User user) {
        try {
            log.info("Syncing all transactions from Flutterwave for user {}", user.getId());
            
            // Get or create wallet entity (fetching directly from repository)
            Wallet wallet = walletRepository.findByUserId(user.getId()).orElse(null);
            if (wallet == null) {
                // Create wallet if it doesn't exist
                wallet = Wallet.builder()
                        .user(user)
                        .balance(BigDecimal.ZERO)
                        .currency("NGN")
                        .status(Wallet.Status.ACTIVE)
                        .build();
                wallet = walletRepository.save(wallet);
            }
            
            // First, sync balance from existing transactions
            syncBalanceWithFlutterwave(user);
            
            // Refresh wallet after sync
            wallet = walletRepository.findByUserId(user.getId()).orElse(wallet);
            
            // Fetch transactions from Flutterwave API
            // Normalize email to ensure it matches what Flutterwave has
            String normalizedEmail = user.getEmail() != null ? user.getEmail().toLowerCase().trim() : null;
            if (normalizedEmail == null || normalizedEmail.isEmpty()) {
                log.warn("User {} has no email, cannot fetch transactions from Flutterwave", user.getId());
                normalizedEmail = null;
            }
            
            java.util.List<FlutterwaveService.TransactionVerification> flutterwaveTransactions = 
                java.util.Collections.emptyList();
            
            if (normalizedEmail != null) {
                try {
                    flutterwaveTransactions = flutterwaveService.fetchTransactionsByEmail(normalizedEmail);
                    log.info("Fetched {} transactions from Flutterwave for user {} (email: {})", 
                            flutterwaveTransactions.size(), user.getId(), normalizedEmail);
                } catch (Exception e) {
                    log.error("Error fetching transactions from Flutterwave for user {}: {}", user.getId(), e.getMessage(), e);
                    // Continue with pending transaction verification even if fetch fails
                }
            }
            
            int newTransactionsAdded = 0;
            int existingTransactionsSkipped = 0;
            int transactionsUpdated = 0;
            
            log.info("Processing {} transactions fetched from Flutterwave for user {} (email: {})", 
                    flutterwaveTransactions.size(), user.getId(), normalizedEmail);
            
            // Process each transaction from Flutterwave
            for (FlutterwaveService.TransactionVerification verification : flutterwaveTransactions) {
                if (verification.getTxRef() == null || verification.getTxRef().isEmpty()) {
                    log.warn("Skipping transaction with null or empty txRef: flwRef={}", verification.getFlwRef());
                    continue;
                }
                
                String txRef = verification.getTxRef();
                log.debug("Processing transaction: txRef={}, amount={}, status={}", 
                        txRef, verification.getAmount(), verification.getStatus());
                
                try {
                    // Check if transaction already exists in database
                    // Check by FlutterwaveTxRef first, then by reference field (in case txRef is stored in reference)
                    java.util.Optional<Transaction> existingTx = transactionRepository.findByFlutterwaveTxRef(verification.getTxRef());
                    
                    // Also check by reference field in case transaction was stored with txRef in reference field
                    if (!existingTx.isPresent()) {
                        existingTx = transactionRepository.findByReference(verification.getTxRef());
                    }
                    
                    if (existingTx.isPresent()) {
                        // Transaction already exists, but verify it's completed
                        Transaction existing = existingTx.get();
                        // Update transaction with latest information from Flutterwave
                        boolean wasUpdated = false;
                        
                        // Update status if it was pending/processing
                        if (existing.getStatus() != Transaction.Status.COMPLETED) {
                            log.info("Updating existing transaction status from {} to COMPLETED: txRef={}", 
                                    existing.getStatus(), verification.getTxRef());
                            existing.setStatus(Transaction.Status.COMPLETED);
                            wasUpdated = true;
                        }
                        
                        // Update Flutterwave references if missing or different
                        String flwRef = verification.getFlwRef();
                        if (txRef != null && (existing.getFlutterwaveTxRef() == null || !existing.getFlutterwaveTxRef().equals(txRef))) {
                            existing.setFlutterwaveTxRef(txRef);
                            wasUpdated = true;
                        }
                        if (flwRef != null && (existing.getFlutterwaveFlwRef() == null || !existing.getFlutterwaveFlwRef().equals(flwRef))) {
                            existing.setFlutterwaveFlwRef(flwRef);
                            wasUpdated = true;
                        }
                        if (verification.getStatus() != null && (existing.getFlutterwaveStatus() == null || !existing.getFlutterwaveStatus().equals(verification.getStatus()))) {
                            existing.setFlutterwaveStatus(verification.getStatus());
                            wasUpdated = true;
                        }
                        
                        // Update reference field if missing
                        if (txRef != null && (existing.getReference() == null || existing.getReference().isEmpty())) {
                            existing.setReference(txRef);
                            wasUpdated = true;
                        }
                        
                        // Update processedAt timestamp
                        existing.setProcessedAt(java.time.OffsetDateTime.now());
                        
                        if (wasUpdated) {
                            transactionRepository.save(existing);
                            // Recalculate balance
                            syncBalanceWithFlutterwave(user);
                            transactionsUpdated++; // Count as updated
                            log.info("✅ Updated existing transaction: txRef={}, flwRef={}, status={}", 
                                    txRef, flwRef, existing.getStatus());
                        } else {
                            existingTransactionsSkipped++;
                            log.debug("Transaction {} already exists and is up-to-date, skipping", verification.getTxRef());
                        }
                        continue;
                    }
                    
                    // Transaction doesn't exist, create it
                    BigDecimal amount = verification.getAmount() != null ? verification.getAmount() : BigDecimal.ZERO;
                    
                    // CRITICAL: Ensure transaction has proper reference in all fields for reliable tracking
                    String flwRef = verification.getFlwRef();
                    
                    // Use the charged amount (what customer paid), not settled amount
                    log.info("Creating new transaction from Flutterwave sync: txRef={}, amountCharged=NGN {}, flwRef={}, status={}", 
                            txRef, amount, flwRef, verification.getStatus());
                    
                    Transaction newTransaction = Transaction.builder()
                            .wallet(wallet)
                            .user(user)
                            .type(Transaction.Type.DEPOSIT)
                            .status(Transaction.Status.COMPLETED)
                            .amount(amount) // Full charged amount, not settled amount
                            .currency(verification.getCurrency() != null ? verification.getCurrency() : "NGN")
                            .description("Wallet deposit via Flutterwave (synced from Flutterwave dashboard)")
                            // Store reference in multiple fields for reliable matching
                            .reference(txRef) // Primary reference field
                            .flutterwaveTxRef(txRef) // Flutterwave transaction reference
                            .flutterwaveFlwRef(flwRef) // Flutterwave flw reference
                            .flutterwaveStatus(verification.getStatus())
                            .processedAt(java.time.OffsetDateTime.now())
                            .createdAt(java.time.OffsetDateTime.now())
                            .build();
                    
                    transactionRepository.save(newTransaction);
                    newTransactionsAdded++;
                    log.info("✅ Added missing transaction from Flutterwave: txRef={}, amountCharged=NGN {}, flwRef={}, status={}", 
                            txRef, amount, verification.getFlwRef(), verification.getStatus());
                    
                    // Recalculate balance after adding transaction
                    syncBalanceWithFlutterwave(user);
                    wallet = walletRepository.findByUserId(user.getId()).orElse(wallet);
                    log.info("✅ Wallet balance after adding transaction: NGN {}", wallet.getBalance());
                } catch (Exception e) {
                    log.warn("Failed to process transaction {} from Flutterwave: {}", 
                            verification.getTxRef(), e.getMessage());
                    // Continue with other transactions
                }
            }
            
            // Get all pending transactions for this user and verify them
            java.util.List<Transaction> pendingTransactions = java.util.Collections.emptyList();
            if (wallet != null) {
                pendingTransactions = transactionRepository.findByWalletIdAndStatus(wallet.getId(), Transaction.Status.PENDING);
            }
            
            log.info("Found {} pending transactions for user {}", pendingTransactions.size(), user.getId());
            
            // Verify each pending transaction with retry logic
            int pendingVerified = 0;
            int pendingFailed = 0;
            for (Transaction transaction : pendingTransactions) {
                try {
                    // Try to get txRef from FlutterwaveTxRef first, then from reference field
                    String txRef = null;
                    if (transaction.getFlutterwaveTxRef() != null && !transaction.getFlutterwaveTxRef().isEmpty()) {
                        txRef = transaction.getFlutterwaveTxRef();
                    } else if (transaction.getReference() != null && !transaction.getReference().isEmpty()) {
                        txRef = transaction.getReference();
                        log.info("Pending transaction has no FlutterwaveTxRef, using reference field: {}", txRef);
                    }
                    
                    if (txRef != null && !txRef.isEmpty()) {
                        log.info("🔄 Verifying pending transaction: txRef={}, transactionId={}, amount={}", 
                                txRef, transaction.getId(), transaction.getAmount());
                        
                        // Retry verification up to 3 times
                        TransactionResponse result = null;
                        Exception lastError = null;
                        for (int retry = 1; retry <= 3; retry++) {
                            try {
                                result = verifyAndProcessTransaction(txRef, user);
                                if (result != null && result.getStatus() != null && 
                                    "COMPLETED".equalsIgnoreCase(result.getStatus())) {
                                    log.info("✅ Successfully verified and processed pending transaction: txRef={} (attempt {})", 
                                            txRef, retry);
                                    pendingVerified++;
                                    break;
                                }
                            } catch (Exception e) {
                                lastError = e;
                                if (retry < 3) {
                                    log.warn("⚠️ Verification attempt {} failed for txRef={}, retrying... Error: {}", 
                                            retry, txRef, e.getMessage());
                                    Thread.sleep(1000 * retry); // Exponential backoff
                                }
                            }
                        }
                        
                        if (result == null || result.getStatus() == null || 
                            !"COMPLETED".equalsIgnoreCase(result.getStatus())) {
                            pendingFailed++;
                            log.warn("⚠️ Failed to verify pending transaction {} after retries: txRef={}", 
                                    transaction.getId(), txRef);
                        }
                    } else {
                        pendingFailed++;
                        log.warn("⚠️ Pending transaction {} has no txRef or reference to verify. Transaction details: status={}, amount={}, createdAt={}", 
                                transaction.getId(), transaction.getStatus(), transaction.getAmount(), transaction.getCreatedAt());
                    }
                } catch (Exception e) {
                    pendingFailed++;
                    log.error("❌ Failed to verify pending transaction {}: {}", transaction.getId(), e.getMessage(), e);
                    // Continue with other transactions
                }
            }
            
            if (pendingVerified > 0) {
                log.info("✅ Verified {} pending transactions successfully", pendingVerified);
            }
            if (pendingFailed > 0) {
                log.warn("⚠️ Failed to verify {} pending transactions", pendingFailed);
            }
            
            // Final sync to ensure balance is correct
            syncBalanceWithFlutterwave(user);
            wallet = walletRepository.findByUserId(user.getId()).orElse(wallet);
            
            log.info("✅ Completed syncing all transactions for user {}: Added {} new transactions, Updated {} transactions, Skipped {} existing transactions, Final balance: NGN {}", 
                    user.getId(), newTransactionsAdded, transactionsUpdated, existingTransactionsSkipped, wallet.getBalance());
            
            // Log summary of transaction references processed
            if (newTransactionsAdded > 0 || transactionsUpdated > 0) {
                log.info("✅ Successfully processed {} transactions from Flutterwave dashboard for user {}", 
                        newTransactionsAdded + transactionsUpdated, user.getId());
            }
        } catch (Exception e) {
            log.error("Error syncing all transactions for user {}: {}", user.getId(), e.getMessage(), e);
            throw new RuntimeException("Failed to sync all transactions: " + e.getMessage(), e);
        }
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
