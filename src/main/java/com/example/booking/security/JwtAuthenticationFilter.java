package com.example.booking.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.jsonwebtoken.ExpiredJwtException;
import io.jsonwebtoken.JwtException;
import io.jsonwebtoken.MalformedJwtException;
import io.jsonwebtoken.security.SignatureException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.OffsetDateTime;
import java.util.HashMap;
import java.util.Map;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtService jwtService;
    private final BookingUserDetailsService userDetailsService;
    private final ObjectMapper objectMapper;

    public JwtAuthenticationFilter(JwtService jwtService, 
                                   BookingUserDetailsService userDetailsService,
                                   ObjectMapper objectMapper) {
        this.jwtService = jwtService;
        this.userDetailsService = userDetailsService;
        this.objectMapper = objectMapper;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        final String authHeader = request.getHeader(HttpHeaders.AUTHORIZATION);
        
        if (authHeader == null || !authHeader.startsWith("Bearer ")) {
            filterChain.doFilter(request, response);
            return;
        }

        try {
            final String jwt = authHeader.substring(7);
            final String userEmail = jwtService.extractUsername(jwt);

            if (userEmail != null && SecurityContextHolder.getContext().getAuthentication() == null) {
                try {
                    BookingUserDetails userDetails = (BookingUserDetails) this.userDetailsService.loadUserByUsername(userEmail);
                    if (jwtService.isTokenValid(jwt, userDetails.getUser())) {
                        UsernamePasswordAuthenticationToken authToken = new UsernamePasswordAuthenticationToken(
                                userDetails,
                                null,
                                userDetails.getAuthorities()
                        );
                        authToken.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                        SecurityContextHolder.getContext().setAuthentication(authToken);
                    } else {
                        handleJwtError(response, "Authentication token is invalid or does not match the user. Please log in again.");
                        return;
                    }
                } catch (UsernameNotFoundException ex) {
                    handleJwtError(response, "User associated with the authentication token was not found. The token may be invalid or the user may have been deleted.");
                    return;
                }
            }
        } catch (ExpiredJwtException ex) {
            handleJwtError(response, "Your authentication token has expired. Please log in again to obtain a new token.");
            return;
        } catch (MalformedJwtException ex) {
            handleJwtError(response, "Invalid authentication token format. Please ensure you are using a valid JWT token.");
            return;
        } catch (SignatureException ex) {
            handleJwtError(response, "Invalid authentication token signature. The token may have been tampered with or is invalid.");
            return;
        } catch (JwtException ex) {
            handleJwtError(response, "Authentication token validation failed: " + ex.getMessage() + ". Please log in again to obtain a new token.");
            return;
        } catch (Exception ex) {
            handleJwtError(response, "An error occurred while processing your authentication token. Please try logging in again.");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private void handleJwtError(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpStatus.UNAUTHORIZED.value());
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        
        Map<String, Object> body = new HashMap<>();
        body.put("timestamp", OffsetDateTime.now());
        body.put("status", HttpStatus.UNAUTHORIZED.value());
        body.put("error", HttpStatus.UNAUTHORIZED.getReasonPhrase());
        body.put("message", message);
        body.put("path", "Authentication");
        
        objectMapper.writeValue(response.getWriter(), body);
    }
}
