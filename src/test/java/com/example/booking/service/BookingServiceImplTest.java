package com.example.booking.service;

import com.example.booking.dto.booking.BookingRequest;
import com.example.booking.dto.booking.BookingResponse;
import com.example.booking.entity.Booking;
import com.example.booking.entity.Listing;
import com.example.booking.entity.User;
import com.example.booking.exception.BadRequestException;
import com.example.booking.exception.ResourceNotFoundException;
import com.example.booking.repository.BookingRepository;
import com.example.booking.repository.ListingRepository;
import com.example.booking.service.impl.BookingServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class BookingServiceImplTest {

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private ListingRepository listingRepository;

    @InjectMocks
    private BookingServiceImpl bookingService;

    private User guest;
    private User host;
    private Listing listing;

    @BeforeEach
    void setUp() {
        guest = User.builder().id(1L).email("guest@example.com").role(User.Role.GUEST).build();
        host = User.builder().id(2L).email("host@example.com").role(User.Role.HOST).build();
        listing = Listing.builder()
                .id(100L)
                .host(host)
                .title("Modern Loft")
                .location("Lagos")
                .price(BigDecimal.valueOf(500))
                .build();
    }

    @Test
    @DisplayName("createBooking saves booking when dates available")
    void createBooking_success() {
        BookingRequest request = new BookingRequest();
        request.setListingId(listing.getId());
        request.setStartDate(LocalDate.now().plusDays(1));
        request.setEndDate(LocalDate.now().plusDays(5));
        request.setTotalPrice(BigDecimal.valueOf(500));

        when(listingRepository.findById(listing.getId())).thenReturn(Optional.of(listing));
        when(bookingRepository.findOverlappingBookings(eq(listing.getId()), any(), any())).thenReturn(List.of());

        Booking saved = Booking.builder()
                .id(50L)
                .listing(listing)
                .user(guest)
                .startDate(request.getStartDate())
                .endDate(request.getEndDate())
                .totalPrice(request.getTotalPrice())
                .build();

        when(bookingRepository.save(any(Booking.class))).thenReturn(saved);

        BookingResponse response = bookingService.createBooking(request, guest);

        ArgumentCaptor<Booking> captor = ArgumentCaptor.forClass(Booking.class);
        verify(bookingRepository).save(captor.capture());

        Booking captured = captor.getValue();
        assertThat(captured.getListing()).isEqualTo(listing);
        assertThat(captured.getUser()).isEqualTo(guest);
        assertThat(response.getId()).isEqualTo(saved.getId());
        assertThat(response.getStatus()).isEqualTo("UPCOMING");
        assertThat(response.getListing().getTitle()).isEqualTo(listing.getTitle());
    }

    @Test
    @DisplayName("createBooking rejects overlapping dates")
    void createBooking_overlapping() {
        BookingRequest request = new BookingRequest();
        request.setListingId(listing.getId());
        request.setStartDate(LocalDate.now().plusDays(1));
        request.setEndDate(LocalDate.now().plusDays(3));
        request.setTotalPrice(BigDecimal.valueOf(300));

        when(listingRepository.findById(listing.getId())).thenReturn(Optional.of(listing));
        when(bookingRepository.findOverlappingBookings(eq(listing.getId()), any(), any())).thenReturn(List.of(new Booking()));

        assertThatThrownBy(() -> bookingService.createBooking(request, guest))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("already booked");
    }

    @Test
    @DisplayName("createBooking validates date order")
    void createBooking_invalidDates() {
        BookingRequest request = new BookingRequest();
        request.setListingId(listing.getId());
        request.setStartDate(LocalDate.now().plusDays(5));
        request.setEndDate(LocalDate.now().plusDays(2));
        request.setTotalPrice(BigDecimal.valueOf(300));

        when(listingRepository.findById(listing.getId())).thenReturn(Optional.of(listing));

        assertThatThrownBy(() -> bookingService.createBooking(request, guest))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("End date must be after start date");
    }

    @Test
    @DisplayName("getBooking returns booking when found")
    void getBooking_success() {
        Booking booking = Booking.builder().id(77L).listing(listing).user(guest).build();
        when(bookingRepository.findById(77L)).thenReturn(Optional.of(booking));

        BookingResponse response = bookingService.getBooking(77L);

        assertThat(response.getId()).isEqualTo(77L);
        assertThat(response.getListingId()).isEqualTo(listing.getId());
    }

    @Test
    @DisplayName("getBooking throws when not found")
    void getBooking_notFound() {
        when(bookingRepository.findById(88L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> bookingService.getBooking(88L))
                .isInstanceOf(ResourceNotFoundException.class);
    }

    @Test
    @DisplayName("getBookingsForUser delegates to repository")
    void getBookingsForUser_success() {
        Booking booking = Booking.builder().id(5L).listing(listing).user(guest).build();
        Page<Booking> page = new PageImpl<>(List.of(booking));

        when(bookingRepository.findByUserId(eq(guest.getId()), any(Pageable.class))).thenReturn(page);

        Page<BookingResponse> result = bookingService.getBookingsForUser(guest.getId(), PageRequest.of(0, 5), null);

        verify(bookingRepository).findByUserId(eq(guest.getId()), any(Pageable.class));
        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getUserId()).isEqualTo(guest.getId());
        assertThat(result.getContent().get(0).getListing().getId()).isEqualTo(listing.getId());
    }

    @Test
    @DisplayName("getBookingsForUser filters by status")
    void getBookingsForUser_statusFilter() {
        Booking upcoming = Booking.builder().id(60L).listing(listing).user(guest)
                .startDate(LocalDate.now().plusDays(2)).endDate(LocalDate.now().plusDays(4)).build();
        Page<Booking> page = new PageImpl<>(List.of(upcoming));

        when(bookingRepository.findByUserIdAndStartDateAfter(eq(guest.getId()), any(LocalDate.class), any(Pageable.class)))
                .thenReturn(page);

        Page<BookingResponse> result = bookingService.getBookingsForUser(guest.getId(), PageRequest.of(0, 5), "upcoming");

        assertThat(result.getContent()).hasSize(1);
        assertThat(result.getContent().get(0).getStatus()).isEqualTo("UPCOMING");
    }

    @Test
    @DisplayName("getBookingsForUser rejects invalid status")
    void getBookingsForUser_invalidStatus() {
        assertThatThrownBy(() -> bookingService.getBookingsForUser(guest.getId(), PageRequest.of(0, 5), "unknown"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    @DisplayName("cancelBooking allows owner or host")
    void cancelBooking_success_forGuest() {
        Booking booking = Booking.builder().id(40L).listing(listing).user(guest).build();
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        bookingService.cancelBooking(booking.getId(), guest);

        verify(bookingRepository).delete(booking);
    }

    @Test
    @DisplayName("cancelBooking rejects unauthorized user")
    void cancelBooking_unauthorized() {
        Booking booking = Booking.builder().id(41L).listing(listing).user(guest).build();
        User stranger = User.builder().id(999L).role(User.Role.GUEST).build();

        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        assertThatThrownBy(() -> bookingService.cancelBooking(booking.getId(), stranger))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("not allowed");
    }
}
