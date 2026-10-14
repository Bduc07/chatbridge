using System.Security.Claims;
using ChatBridge.API.Data;
using ChatBridge.API.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;

namespace ChatBridge.API.Hubs;

[Authorize]
public class ChatHub : Hub
{
    private readonly AppDbContext _context;

    public ChatHub(AppDbContext context)
    {
        _context = context;
    }

    public async Task SendMessage(string receiverId, string content)
    {
        var senderId = Context.User?.FindFirst(
            ClaimTypes.NameIdentifier)?.Value;

        if (!int.TryParse(senderId, out var senderUserId))
        {
            throw new HubException("Unable to identify sender.");
        }

        if (!int.TryParse(receiverId, out var receiverUserId))
        {
            throw new HubException("Invalid receiver ID.");
        }

        if (senderUserId == receiverUserId)
        {
            throw new HubException("You cannot message yourself.");
        }

        if (string.IsNullOrWhiteSpace(content))
        {
            throw new HubException("Message cannot be empty.");
        }

        content = content.Trim();

        if (content.Length > 2000)
        {
            throw new HubException("Message cannot exceed 2000 characters.");
        }

        var receiverExists = await _context.Users
            .AnyAsync(user => user.Id == receiverUserId);

        if (!receiverExists)
        {
            throw new HubException("Receiver does not exist.");
        }

        var message = new ChatMessage
        {
            SenderId = senderUserId,
            ReceiverId = receiverUserId,
            Content = content,
            SentAt = DateTime.UtcNow
        };

        _context.Messages.Add(message);
        await _context.SaveChangesAsync();

        await Clients.Users(senderUserId.ToString(), receiverUserId.ToString())
            .SendAsync("ReceiveMessage", new
            {
                message.Id,
                message.SenderId,
                message.ReceiverId,
                message.Content,
                message.SentAt
            });
    }
}