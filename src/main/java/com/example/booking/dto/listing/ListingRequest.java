package com.example.booking.dto.listing;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.util.List;
import java.util.Set;

@Data
@Schema(description = "Request to create or update a listing")
public class ListingRequest {
    @NotBlank
    @Schema(description = "Listing title", example = "Cozy 2-Bedroom Apartment in Downtown")
    private String title;

    @Schema(description = "Detailed description of the listing", 
            example = "Beautiful apartment with modern amenities, located in the heart of the city. Perfect for families or professionals.")
    private String description;

    @NotNull
    @Schema(description = "Price per night", example = "150.00")
    private BigDecimal price;

    @NotBlank
    @Schema(description = "Location address", example = "123 Main Street, New York, NY 10001")
    private String location;

    @Schema(description = "Set of amenities", example = "[\"WiFi\", \"Air Conditioning\", \"Parking\", \"Kitchen\"]")
    private Set<String> amenities;

    @Schema(description = "Set of policies", example = "[\"No smoking\", \"No pets\", \"Check-in after 3 PM\"]")
    private Set<String> policies;

    @Schema(description = "Primary image URL or base64 data URI", example = "data:image/jpeg;base64,/9j/4AAQSkZJRg...")
    private String image;

    @Schema(description = "Array of image URLs or base64 data URIs", example = "[\"data:image/jpeg;base64,...\", \"https://example.com/image.jpg\"]")
    private List<String> images;

    @Schema(description = "Array of photo URLs or base64 data URIs (alias for images)", example = "[\"data:image/jpeg;base64,...\"]")
    private List<String> photos;

    @Schema(description = "Image URL (alternative field name)", example = "https://example.com/image.jpg")
    private String imageUrl;

    @Schema(description = "Array of image URLs (alternative field name)", example = "[\"https://example.com/image1.jpg\", \"https://example.com/image2.jpg\"]")
    private List<String> imageUrls;
}
