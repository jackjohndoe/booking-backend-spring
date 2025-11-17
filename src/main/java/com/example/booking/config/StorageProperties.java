package com.example.booking.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "storage")
public class StorageProperties {

    /**
     * Base directory for storing files on the local filesystem.
     */
    private String localBasePath = "uploads";

    /**
     * Public URL prefix used to serve stored files.
     */
    private String publicUrl = "http://localhost:8080/api/files";

    public String getLocalBasePath() {
        return localBasePath;
    }

    public void setLocalBasePath(String localBasePath) {
        this.localBasePath = localBasePath;
    }

    public String getPublicUrl() {
        return publicUrl;
    }

    public void setPublicUrl(String publicUrl) {
        this.publicUrl = publicUrl;
    }
}
