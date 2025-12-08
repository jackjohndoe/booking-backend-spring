package com.example.booking.service;

import com.example.booking.dto.wallet.DepositRequest;
import com.example.booking.dto.wallet.TransactionResponse;
import com.example.booking.dto.wallet.WalletResponse;
import com.example.booking.dto.wallet.WithdrawalRequest;
import com.example.booking.entity.User;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;

public interface WalletService {
    WalletResponse getOrCreateWallet(User user);
    WalletResponse getWallet(User user);
    TransactionResponse deposit(DepositRequest request, User user);
    TransactionResponse withdraw(WithdrawalRequest request, User user);
    Page<TransactionResponse> getTransactions(User user, Pageable pageable);
    void processEscrowHold(Long bookingId, BigDecimal amount, User user);
    void processEscrowRelease(Long bookingId, User host);
    void processRefund(Long bookingId, String reason);
    TransactionResponse requestPayout(WithdrawalRequest request, User user);
    void processFlutterwaveWebhook(String event, String txRef, String flwRef, BigDecimal amount, String status, String customerEmail);
    void syncBalanceWithFlutterwave(User user);
    TransactionResponse verifyAndProcessTransaction(String txRef, User user);
    void syncAllTransactionsFromFlutterwave(User user);
}
