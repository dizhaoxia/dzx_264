package com.recruit.service;

import com.recruit.config.MinioConfig;
import io.minio.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStream;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class MinioService {

    private final MinioClient minioClient;
    private final MinioConfig minioConfig;

    public String uploadFile(MultipartFile file) throws Exception {
        String bucketName = minioConfig.getBucketName();

        if (!minioClient.bucketExists(BucketExistsArgs.builder().bucket(bucketName).build())) {
            minioClient.makeBucket(MakeBucketArgs.builder().bucket(bucketName).build());
        }

        String originalFilename = file.getOriginalFilename();
        String fileExtension = originalFilename != null && originalFilename.contains(".")
                ? originalFilename.substring(originalFilename.lastIndexOf("."))
                : "";
        String objectName = UUID.randomUUID().toString() + fileExtension;

        minioClient.putObject(
            PutObjectArgs.builder()
                .bucket(bucketName)
                .object(objectName)
                .stream(file.getInputStream(), file.getSize(), -1)
                .contentType(file.getContentType())
                .build()
        );

        return minioConfig.getEndpoint() + "/" + bucketName + "/" + objectName;
    }

    public InputStream getFile(String fileUrl) throws Exception {
        String bucketName = minioConfig.getBucketName();
        String objectName = fileUrl.substring(fileUrl.lastIndexOf("/") + 1);

        return minioClient.getObject(
            GetObjectArgs.builder()
                .bucket(bucketName)
                .object(objectName)
                .build()
        );
    }

    public void deleteFile(String fileUrl) throws Exception {
        String bucketName = minioConfig.getBucketName();
        String objectName = fileUrl.substring(fileUrl.lastIndexOf("/") + 1);

        minioClient.removeObject(
            RemoveObjectArgs.builder()
                .bucket(bucketName)
                .object(objectName)
                .build()
        );
    }
}
