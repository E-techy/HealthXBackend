const Friendship = require('../models/Friendship');

const requireDelegatedAccess = (requiredAction) => {
    return async (req, res, next) => {
        try {
            // 1. Check if the user is trying to access someone else's data
            const targetUserId = req.header('X-Target-User-Id');

            // If no target ID is provided, it's a normal request for their own data.
            // Let it pass through to the controller.
            if (!targetUserId || targetUserId === req.user.id) {
                return next(); 
            }

            // 2. Delegated Access Flow triggered
            const viewerId = req.user.id; // User B (from requireJWT)

            // 3. Look up the active friendship connection
            const friendship = await Friendship.findOne({
                ownerId: targetUserId, // User A
                viewerId: viewerId     // User B
            });

            if (!friendship) {
                return res.status(403).json({
                    success: false,
                    message: "Access denied. No active connection found with this user."
                });
            }

            // 4. Validate Backend-Defined Permission
            // Check if they have the specific action requested by the route, OR the 'ALL' wildcard
            const hasPermission = friendship.permissions.some(
                (p) => (p.action === requiredAction || p.action === 'ALL') && p.isActive === true
            );

            if (!hasPermission) {
                return res.status(403).json({
                    success: false,
                    message: `Access denied. You do not have permission to view or manage ${requiredAction} for this user.`
                });
            }

            // 5. The Context Swap
            // Save the original viewer ID just in case downstream logic needs an audit trail
            req.viewerId = viewerId; 
            
            // Override the ID so the standard controller fetches User A's data seamlessly
            req.user.id = targetUserId; 

            next();

        } catch (error) {
            console.error("🔥 Error in delegated access middleware:", error);
            res.status(500).json({ success: false, message: "Server error verifying access." });
        }
    };
};

module.exports = { requireDelegatedAccess };