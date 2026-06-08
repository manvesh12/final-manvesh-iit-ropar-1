package com.iitropar.dsr.dto;
import lombok.AllArgsConstructor;
import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
@AllArgsConstructor
public class JwtResponse {
    private String token;
    private String username;
    private String email;
    private String fullName;
    private String role;
    private List<String> permissions;
    private Map<String, Object> scope;
    private String accessLabel;
}
