using System.Security.Claims;
using ChatBridge.API.Data;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace ChatBridge.API.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class MessagesController : ControllerBase
{
    private readonly AppDbContext _context;

    public MessagesController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("{userId:int}")]
    public async Task<IActionResult> GetConversation(int userId)
    {
        var currentUserId = User.FindFirst(
            ClaimTypes.NameIdentifier)?.Value;

        if (!int.TryParse(currentUserId, out var currentId))
        {
            return Unauthorized();
        }

        if (currentId == userId)
        {
            return BadRequest("You cannot open a conversation with yourself.");
        }

        var userExists = await _context.Users
            .AnyAsync(user => user.Id == userId);

        if (!userExists)
        {
            return NotFound("User not found.");
        }

        var messages = await _context.Messages
            .Where(message =>
                (message.SenderId == currentId &&
                 message.ReceiverId == userId) ||
                (message.SenderId == userId &&
                 message.ReceiverId == currentId))
            .OrderBy(message => message.SentAt)
            .ToListAsync();

        return Ok(messages);
    }
}