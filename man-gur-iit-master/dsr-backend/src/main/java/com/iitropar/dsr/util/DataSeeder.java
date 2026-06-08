package com.iitropar.dsr.util;

import com.iitropar.dsr.entity.Role;
import com.iitropar.dsr.entity.User;
import com.iitropar.dsr.repository.UserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {

    @Autowired
    private UserRepository userRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        seedUser("admin", "Administrator", "admin@dsr.com", "admin123", Role.ADMIN, "", "", "", "Full");
        seedUser("dc", "District Commissioner (Jalandhar)", "dc@dsr.com", "dc123", Role.DISTRICT_OWNER, "Jalandhar", "", "", "District review");
        seedUser("officer", "Geology Officer", "officer@dsr.com", "officer123", Role.OFFICER, "Jalandhar", "", "", "Legacy data entry");
        seedUser("reviewer", "State Reviewer", "reviewer@dsr.com", "reviewer123", Role.REVIEWER, "", "", "", "Legacy reviewer");

        seedUser("iit@demo.com", "IIT Ropar Survey Team", "iit@demo.com", "password123", Role.IIT_ROPAR, "", "", "", "Front matter + Chapters 1-4 + Review");
        seedUser("sdlc@demo.com", "SDLC Committee", "sdlc@demo.com", "password123", Role.SDLC, "Jalandhar", "", "", "District-level SDLC data");
        seedUser("sdo@demo.com", "Sub-Divisional Officer", "sdo@demo.com", "password123", Role.SDO, "Jalandhar", "Block A", "", "Chapters 5-10");
        seedUser("je@demo.com", "Junior Engineer Field Team", "je@demo.com", "password123", Role.JE, "Jalandhar", "Block A", "Field Data", "Field data");
        seedUser("axen@demo.com", "Assistant Executive Engineer", "axen@demo.com", "password123", Role.AXEN, "Jalandhar", "", "Section A", "Assigned section");
        seedUser("gis@demo.com", "GIS Team", "gis@demo.com", "password123", Role.GIS, "", "", "", "Plates + Graphs + Annexures + Review");
        seedUser("reviewer1@gov.in", "Government Reviewer 1", "reviewer1@gov.in", "password123", Role.REVIEWER_1, "", "", "", "Govt review");
        seedUser("reviewer2@gov.in", "Government Reviewer 2", "reviewer2@gov.in", "password123", Role.REVIEWER_2, "", "", "", "Govt review");
        seedUser("admin@demo.com", "Portal Administrator", "admin@demo.com", "password123", Role.ADMIN, "", "", "", "Full");

        System.out.println("==========================================");
        System.out.println("Default users created:");
        System.out.println("Admin: admin / admin123");
        System.out.println("DC: dc / dc123");
        System.out.println("Officer: officer / officer123");
        System.out.println("Reviewer: reviewer / reviewer123");
        System.out.println("Demo RBAC users: iit@demo.com, sdlc@demo.com, sdo@demo.com, je@demo.com, axen@demo.com, gis@demo.com, reviewer1@gov.in, reviewer2@gov.in, admin@demo.com / password123");
        System.out.println("==========================================");
    }

    private void seedUser(String username, String fullName, String email, String password, Role role, String district, String block, String section, String accessScope) {
        if (userRepository.existsByUsername(username)) return;
        User user = User.builder()
                .fullName(fullName)
                .username(username)
                .email(email)
                .password(passwordEncoder.encode(password))
                .role(role)
                .district(district)
                .blockName(block)
                .sectionName(section)
                .accessScope(accessScope)
                .active(true)
                .build();
        userRepository.save(user);
    }
}
