# 🚀 Quick Start - Get Backend Running in 2 Minutes

## Start the Backend

```bash
cd booking-backend
./start-staging.sh
```

That's it! The backend will be available at:
- **API**: http://localhost:8080/api
- **Swagger UI**: http://localhost:8080/swagger-ui.html
- **Health Check**: http://localhost:8080/api/health

## Share with Frontend Team

**Send them these 3 things:**

1. **API Base URL**: `http://localhost:8080/api`
2. **Swagger Documentation**: `http://localhost:8080/swagger-ui.html`
3. **Integration Guide**: `FRONTEND_INTEGRATION_GUIDE.md`

## If Something Goes Wrong

### Port Already in Use?
```bash
export SERVER_PORT=8081
./start-staging.sh
```

### Database Not Found?
```bash
createdb booking_db
./start-staging.sh
```

### Need Different CORS Origins?
```bash
export CORS_ALLOWED_ORIGINS=http://localhost:3000,https://your-frontend.com
./start-staging.sh
```

## Full Documentation

- **Next Steps**: See `NEXT_STEPS.md` for detailed instructions
- **Frontend Guide**: See `FRONTEND_INTEGRATION_GUIDE.md` for API details
- **Staging Guide**: See `STAGING_DEPLOYMENT.md` for configuration

---

**That's all you need to get started!** 🎉

