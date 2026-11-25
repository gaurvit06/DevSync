package com.devsync.identity;

import jakarta.servlet.http.*;
import jakarta.validation.Valid;
import jakarta.validation.constraints.*;
import java.util.*;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.*;
import org.springframework.security.core.context.*;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
  private final AuthService auth;
  private final UserRepository users;

  public AuthController(AuthService a, UserRepository u) {
    auth = a;
    users = u;
  }

  record Register(
      @NotBlank @Size(max = 100) String name,
      @Email @NotBlank String email,
      @Size(min = 8, max = 72) String password) {}

  record Login(@NotBlank String email, @NotBlank String password) {}

  @GetMapping("/csrf")
  Object csrf(CsrfToken t) {
    return Map.of("token", t.getToken());
  }

  @PostMapping("/register")
  @ResponseStatus(org.springframework.http.HttpStatus.CREATED)
  Object register(@Valid @RequestBody Register r) {
    return auth.view(auth.register(r.name, r.email, r.password));
  }

  @PostMapping("/login")
  Object login(@Valid @RequestBody Login r, HttpServletRequest q, HttpServletResponse s) {
    var u = auth.login(r.email, r.password);
    if (q.getSession(false) != null) q.changeSessionId();
    var context = SecurityContextHolder.createEmptyContext();
    context.setAuthentication(
        new UsernamePasswordAuthenticationToken(u.id.toString(), null, List.of()));
    SecurityContextHolder.setContext(context);
    new HttpSessionSecurityContextRepository().saveContext(context, q, s);
    return auth.view(u);
  }

  @GetMapping("/me")
  Object me(Authentication a) {
    if (a == null)
      throw new org.springframework.web.server.ResponseStatusException(
          org.springframework.http.HttpStatus.UNAUTHORIZED, "Please sign in");
    return auth.view(users.findById(Long.valueOf(a.getName())).orElseThrow());
  }
}
