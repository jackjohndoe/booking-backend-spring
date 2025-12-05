package com.example.booking.service;

import org.springframework.core.io.Resource;
import org.springframework.web.multipart.MultipartFile;

public interface StorageService {
    String store(MultipartFile file, String directory);
    Resource loadAsResource(String path);
    void delete(String path);
    String resolveUrl(String path);
}
