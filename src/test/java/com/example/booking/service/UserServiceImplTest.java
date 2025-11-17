package com.example.booking.service;

import com.example.booking.dto.auth.RegisterRequest;
import com.example.booking.dto.user.UserProfileResponse;
import com.example.booking.dto.user.UserProfileUpdateRequest;
import com.example.booking.entity.User;
import com.example.booking.exception.ResourceNotFoundException;
import com.example.booking.repository.UserRepository;
import com.example.booking.service.impl.UserServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class UserServiceImplTest {

    @Mock
    private UserRepository userRepository;

    @Mock
    private PasswordEncoder passwordEncoder;

    @Mock
    private StorageService storageService;

    @InjectMocks
    private UserServiceImpl userService;

    private RegisterRequest registerRequest;
    private User user;

    @BeforeEach
    void setUp() {
        registerRequest = new RegisterRequest();
        registerRequest.setName("Jane Doe");
        registerRequest.setEmail("jane@example.com");
        registerRequest.setPhone("+111");
        registerRequest.setPassword("password");
        registerRequest.setRole("GUEST");

        user = User.builder()
                .id(1L)
                .name("Jane Doe")
                .email("jane@example.com")
                .role(User.Role.GUEST)
                .build();
    }

    @Test
    @DisplayName("getProfile returns profile response")
    void getProfile_success() {
        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));

        UserProfileResponse response = userService.getProfile(user.getId());

        assertThat(response.getId()).isEqualTo(user.getId());
        assertThat(response.getName()).isEqualTo(user.getName());
    }

    @Test
    @DisplayName("getProfile throws when missing")
    void getProfile_notFound() {
        when(userRepository.findById(user.getId())).thenReturn(Optional.empty());

        assertThatThrownBy(() -> userService.getProfile(user.getId()))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("updateProfile saves new values")
    void updateProfile_success() {
        UserProfileUpdateRequest request = new UserProfileUpdateRequest();
        request.setName("Jane Updated");
        request.setPhone("+222");
        request.setBio("Traveler");
        request.setLocation("NYC");

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserProfileResponse response = userService.updateProfile(user.getId(), request);

        assertThat(response.getName()).isEqualTo("Jane Updated");
        assertThat(response.getBio()).isEqualTo("Traveler");
        verify(userRepository).save(user);
    }

    @Test
    @DisplayName("updateAvatar stores file and updates profile")
    void updateAvatar_success() {
        MockMultipartFile file = new MockMultipartFile("file", "avatar.png", "image/png", "bytes".getBytes());

        when(userRepository.findById(user.getId())).thenReturn(Optional.of(user));
        when(storageService.store(file, "avatars/" + user.getId())).thenReturn("avatars/1/avatar.png");
        when(storageService.resolveUrl("avatars/1/avatar.png")).thenReturn("http://localhost/api/files/avatars/1/avatar.png");
        when(userRepository.save(any(User.class))).thenAnswer(invocation -> invocation.getArgument(0));

        UserProfileResponse response = userService.updateAvatar(user.getId(), file);

        assertThat(response.getAvatarUrl()).isEqualTo("http://localhost/api/files/avatars/1/avatar.png");
        verify(storageService).store(file, "avatars/" + user.getId());
    }
}
