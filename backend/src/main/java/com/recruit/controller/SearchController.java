package com.recruit.controller;

import com.recruit.dto.SearchResultDTO;
import com.recruit.service.SearchService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/search")
@RequiredArgsConstructor
public class SearchController {

    private final SearchService searchService;

    @GetMapping
    public ResponseEntity<SearchResultDTO> search(
            @RequestParam(required = false, defaultValue = "") String q,
            @RequestParam(required = false) String sortBy,
            @RequestParam(required = false) Long positionId,
            @RequestParam(required = false, defaultValue = "1") int page,
            @RequestParam(required = false, defaultValue = "10") int size) {
        return ResponseEntity.ok(searchService.search(q, sortBy, positionId, page, size));
    }
}
