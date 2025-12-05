package com.example.booking.service.impl;

import com.example.booking.config.StorageProperties;
import com.example.booking.exception.ResourceNotFoundException;
import com.example.booking.exception.StorageException;
import com.example.booking.service.StorageService;
import org.springframework.core.io.Resource;
import org.springframework.core.io.UrlResource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.MalformedURLException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardCopyOption;
import java.util.UUID;

@Service
public class LocalStorageService implements StorageService {

    private final StorageProperties properties;
    private final Path rootLocation;

    public LocalStorageService(StorageProperties properties) {
        this.properties = properties;
        this.rootLocation = Paths.get(properties.getLocalBasePath()).toAbsolutePath().normalize();
        init();
    }

    private void init() {
        try {
            Files.createDirectories(rootLocation);
        } catch (IOException e) {
            throw new StorageException("Could not initialize storage", e);
        }
    }

    @Override
    public String store(MultipartFile file, String directory) {
        if (file == null || file.isEmpty()) {
            throw new StorageException("Cannot store empty file");
        }

        String originalFilename = StringUtils.cleanPath(file.getOriginalFilename() != null ? file.getOriginalFilename() : "");
        String extension = "";
        int dot = originalFilename.lastIndexOf('.');
        if (dot >= 0) {
            extension = originalFilename.substring(dot);
        }
        String filename = UUID.randomUUID() + extension;

        if (filename.contains("..")) {
            throw new StorageException("Cannot store file with relative path outside current directory");
        }

        try {
            Path directoryPath = rootLocation.resolve(directory).normalize();
            Files.createDirectories(directoryPath);
            Path destinationFile = directoryPath.resolve(filename).normalize();
            Files.copy(file.getInputStream(), destinationFile, StandardCopyOption.REPLACE_EXISTING);
            Path relativePath = rootLocation.relativize(destinationFile);
            return relativePath.toString().replace('\\', '/');
        } catch (IOException e) {
            throw new StorageException("Failed to store file", e);
        }
    }

    @Override
    public Resource loadAsResource(String path) {
        try {
            Path filePath = rootLocation.resolve(path).normalize();
            Resource resource = new UrlResource(filePath.toUri());
            if (resource.exists() && resource.isReadable()) {
                return resource;
            }
            throw new ResourceNotFoundException("File not found: " + path);
        } catch (MalformedURLException e) {
            throw new ResourceNotFoundException("File not found: " + path);
        }
    }

    @Override
    public void delete(String path) {
        if (path == null || path.isBlank()) {
            return;
        }
        try {
            Path filePath = rootLocation.resolve(path).normalize();
            Files.deleteIfExists(filePath);
        } catch (IOException e) {
            throw new StorageException("Failed to delete file: " + path, e);
        }
    }

    @Override
    public String resolveUrl(String path) {
        if (path == null || path.isBlank()) {
            return null;
        }
        String base = properties.getPublicUrl();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        return base + "/" + path.replace("\\", "/");
    }
}
