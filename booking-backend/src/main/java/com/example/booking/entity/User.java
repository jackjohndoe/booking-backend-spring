package com.example.booking.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import lombok.*;

import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "users")
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @NotBlank
    private String name;

    @Email
    @Column(nullable = false, unique = true)
    private String email;

    private String phone;

    @NotBlank
    private String password;

    private String avatarUrl;

    @Column(length = 1000)
    private String bio;

    private String location;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Role role;

    @OneToMany(mappedBy = "host", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private Set<Listing> listings = new HashSet<>();

    // Static virtual account fields for wallet funding
    @Column(name = "virtual_account_number")
    private String virtualAccountNumber;

    @Column(name = "virtual_account_bank")
    private String virtualAccountBank;

    @Column(name = "virtual_account_name")
    private String virtualAccountName;

    @Column(name = "virtual_account_flw_ref")
    private String virtualAccountFlwRef;

    @Column(name = "virtual_account_created_at")
    private java.time.LocalDateTime virtualAccountCreatedAt;

    public enum Role {
        GUEST,
        HOST,
        ADMIN
    }
}
