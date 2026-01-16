package com.example.booking.util;

import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Base64;

/**
 * Utility class to convert base64 data URIs to MultipartFile
 */
public class Base64ToMultipartFile implements MultipartFile {
    private final byte[] content;
    private final String name;
    private final String originalFilename;
    private final String contentType;

    public Base64ToMultipartFile(String base64DataUri) {
        if (base64DataUri == null || base64DataUri.trim().isEmpty()) {
            throw new IllegalArgumentException("Base64 data URI cannot be null or empty");
        }

        // Parse data URI format: data:image/jpeg;base64,/9j/4AAQSkZJRg...
        String[] parts = base64DataUri.split(",");
        if (parts.length != 2) {
            throw new IllegalArgumentException("Invalid base64 data URI format");
        }

        String header = parts[0]; // data:image/jpeg;base64
        String base64Data = parts[1]; // actual base64 string

        // Extract content type
        if (header.contains(";base64")) {
            this.contentType = header.substring(5, header.indexOf(";base64"));
        } else {
            this.contentType = "image/jpeg"; // default
        }

        // Decode base64
        try {
            this.content = Base64.getDecoder().decode(base64Data);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid base64 data: " + e.getMessage());
        }

        // Generate filename
        String extension = getExtensionFromContentType(this.contentType);
        this.originalFilename = "image_" + System.currentTimeMillis() + extension;
        this.name = this.originalFilename;
    }

    private String getExtensionFromContentType(String contentType) {
        if (contentType == null) {
            return ".jpg";
        }
        if (contentType.contains("jpeg") || contentType.contains("jpg")) {
            return ".jpg";
        } else if (contentType.contains("png")) {
            return ".png";
        } else if (contentType.contains("gif")) {
            return ".gif";
        } else if (contentType.contains("webp")) {
            return ".webp";
        }
        return ".jpg"; // default
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public String getOriginalFilename() {
        return originalFilename;
    }

    @Override
    public String getContentType() {
        return contentType;
    }

    @Override
    public boolean isEmpty() {
        return content == null || content.length == 0;
    }

    @Override
    public long getSize() {
        return content != null ? content.length : 0;
    }

    @Override
    public byte[] getBytes() throws IOException {
        return content;
    }

    @Override
    public InputStream getInputStream() throws IOException {
        return new ByteArrayInputStream(content);
    }

    @Override
    public void transferTo(java.io.File dest) throws IOException, IllegalStateException {
        java.nio.file.Files.write(dest.toPath(), content);
    }
}

