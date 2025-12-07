package com.example.booking.repository;

import com.example.booking.entity.Transaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface TransactionRepository extends JpaRepository<Transaction, Long> {
    Page<Transaction> findByUserIdOrderByCreatedAtDesc(Long userId, Pageable pageable);
    Page<Transaction> findByWalletIdOrderByCreatedAtDesc(Long walletId, Pageable pageable);
    List<Transaction> findByBookingId(Long bookingId);
    
    @Query("SELECT t FROM Transaction t WHERE t.booking.id = :bookingId AND t.type = :type")
    Optional<Transaction> findByBookingIdAndType(@Param("bookingId") Long bookingId, 
                                                  @Param("type") Transaction.Type type);
    
    @Query("SELECT SUM(t.amount) FROM Transaction t WHERE t.wallet.id = :walletId AND t.status = 'COMPLETED' AND t.type IN :types")
    java.math.BigDecimal sumAmountByWalletAndTypes(@Param("walletId") Long walletId, 
                                                   @Param("types") List<Transaction.Type> types);
    
    Optional<Transaction> findByReference(String reference);
    
    Optional<Transaction> findByFlutterwaveTxRef(String flutterwaveTxRef);
    
    Optional<Transaction> findByFlutterwaveFlwRef(String flutterwaveFlwRef);
    
    Optional<Transaction> findByFlutterwaveTransferId(String flutterwaveTransferId);
    
    List<Transaction> findByWalletIdAndStatus(Long walletId, Transaction.Status status);
}
