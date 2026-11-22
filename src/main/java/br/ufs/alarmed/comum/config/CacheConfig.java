package br.ufs.alarmed.comum.config;

import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;
import org.springframework.web.servlet.HandlerInterceptor;
import jakarta.servlet.http.*;

@Configuration
public class CacheConfig implements WebMvcConfigurer {
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(new HandlerInterceptor() {
            @Override public boolean preHandle(HttpServletRequest req, HttpServletResponse res, Object handler) {
                res.setHeader("Cache-Control", "no-store");
                return true;
            }
        }).addPathPatterns("/doses", "/registros/**", "/push/**", "/sessao", "/planos/**", "/login", "/logout", "/contas");
    }
}
