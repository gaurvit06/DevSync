package com.devsync.identity;

import java.util.*;
import org.springframework.http.HttpStatus;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

@Service
public class AuthService {
  private final UserRepository users;
  private final PasswordEncoder passwords;

  public AuthService(UserRepository u, PasswordEncoder p) {
    users = u;
    passwords = p;
  }

  public User register(String name, String email, String password) {
    var normalized = email.trim().toLowerCase(Locale.ROOT);
    if (users.findByEmail(normalized).isPresent())
      throw new ResponseStatusException(HttpStatus.CONFLICT, "Email already registered");
    var u = new User();
    u.name = name.trim();
    u.email = normalized;
    u.passwordHash = passwords.encode(password);
    return users.save(u);
  }

  public User login(String email, String password) {
    var u =
        users
            .findByEmail(email.trim().toLowerCase(Locale.ROOT))
            .orElseThrow(
                () -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials"));
    if (!passwords.matches(password, u.passwordHash))
      throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid credentials");
    return u;
  }

  public Map<String, Object> view(User u) {
    return Map.of("id", u.id, "name", u.name, "email", u.email);
  }
}
