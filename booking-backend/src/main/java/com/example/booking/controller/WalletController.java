package com.example.booking.controller;

import com.example.booking.dto.common.PageResponse;
import com.example.booking.dto.wallet.DepositRequest;
import com.example.booking.dto.wallet.TransactionResponse;
import com.example.booking.dto.wallet.WalletResponse;
import com.example.booking.dto.wallet.WithdrawalRequest;
import com.example.booking.security.BookingUserDetails;
import com.example.booking.service.WalletService;
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
@RequestMapping("/api/wallet")
@Tag(name = "Wallet", description = "Wallet and transaction management endpoints")
public class WalletController {

    private final WalletService walletService;

    public WalletController(WalletService walletService) {
        this.walletService = walletService;
    }

    @Operation(summary = "Get wallet", description = "Retrieves or creates the authenticated user's wallet")
    @ApiResponse(responseCode = "200", description = "Wallet retrieved successfully",
            content = @Content(schema = @Schema(implementation = WalletResponse.class)))
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping
    public ResponseEntity<WalletResponse> getWallet(@AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(walletService.getOrCreateWallet(userDetails.getUser()));
    }

    @Operation(summary = "Deposit funds", description = "Adds funds to the user's wallet via payment provider")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Deposit successful",
                    content = @Content(schema = @Schema(implementation = TransactionResponse.class))),
            @ApiResponse(responseCode = "400", description = "Payment failed or invalid amount")
    })
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/deposit")
    public ResponseEntity<TransactionResponse> deposit(@Valid @RequestBody DepositRequest request,
                                                       @AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(walletService.deposit(request, userDetails.getUser()));
    }

    @Operation(summary = "Withdraw funds", description = "Withdraws funds from wallet to bank account")
    @ApiResponses(value = {
            @ApiResponse(responseCode = "200", description = "Withdrawal initiated",
                    content = @Content(schema = @Schema(implementation = TransactionResponse.class))),
            @ApiResponse(responseCode = "400", description = "Insufficient balance or invalid amount")
    })
    @SecurityRequirement(name = "bearerAuth")
    @PostMapping("/withdraw")
    public ResponseEntity<TransactionResponse> withdraw(@Valid @RequestBody WithdrawalRequest request,
                                                        @AuthenticationPrincipal BookingUserDetails userDetails) {
        return ResponseEntity.ok(walletService.withdraw(request, userDetails.getUser()));
    }

    @Operation(summary = "Get transaction history", description = "Retrieves paginated transaction history for the user's wallet")
    @ApiResponse(responseCode = "200", description = "Transactions retrieved successfully",
            content = @Content(schema = @Schema(implementation = PageResponse.class)))
    @SecurityRequirement(name = "bearerAuth")
    @GetMapping("/transactions")
    public ResponseEntity<PageResponse<TransactionResponse>> getTransactions(
            @AuthenticationPrincipal BookingUserDetails userDetails,
            @Parameter(description = "Page number (0-indexed)") @RequestParam(name = "page", defaultValue = "0") int page,
            @Parameter(description = "Page size") @RequestParam(name = "size", defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size);
        return ResponseEntity.ok(PageResponse.from(walletService.getTransactions(userDetails.getUser(), pageable)));
    }
}
