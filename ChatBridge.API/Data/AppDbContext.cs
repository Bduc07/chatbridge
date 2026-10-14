using ChatBridge.API.Models;
using Microsoft.EntityFrameworkCore;

namespace ChatBridge.API.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(
        DbContextOptions<AppDbContext> options)
        : base(options)
    {
    }

    public DbSet<AppUser> Users => Set<AppUser>();

    public DbSet<ChatMessage> Messages => Set<ChatMessage>();
}