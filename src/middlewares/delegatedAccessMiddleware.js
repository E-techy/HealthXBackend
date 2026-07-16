const Friendship = require('../models/Friendship');

const requireDelegatedAccess = (requiredAction) => {
    return async (req, res, next) => {
        try {
            console.log(`\n======================================================`);
            console.log(`🛡️  DELEGATED ACCESS MIDDLEWARE TRIGGERED`);
            console.log(`📍 Route Action Required: [${requiredAction}]`);
            
            // 1. Check if the user is trying to access someone else's data
            const targetUserId = req.header('X-Target-User-Id');
            
            console.log(`📥 Incoming Headers:`, {
                authorization: req.headers.authorization ? 'Bearer [HIDDEN]' : 'Missing',
                'x-target-user-id': targetUserId || 'Missing'
            });

            // If no target ID is provided, it's a normal request for their own data.
            if (!targetUserId || targetUserId === req.user.id) {
                console.log(`👤 No valid guest target. Proceeding as NORMAL USER (${req.user.id}).`);
                console.log(`======================================================\n`);
                return next(); 
            }

            // 2. Delegated Access Flow triggered
            const viewerId = req.user.id; // User B
            console.log(`🕵️‍♂️ Viewer (Current Session): ${viewerId}`);
            console.log(`🎯 Target Owner (Requested Data): ${targetUserId}`);

            // 3. Look up the active friendship connection
            const friendship = await Friendship.findOne({
                ownerId: targetUserId, 
                viewerId: viewerId     
            });

            if (!friendship) {
                console.error(`❌ DENIED: No active Friendship found in DB between ${targetUserId} and ${viewerId}`);
                return res.status(403).json({
                    success: false,
                    message: "Access denied. No active connection found with this user."
                });
            }

            // 4. Validate Backend-Defined Permission
            const hasPermission = friendship.permissions.some(
                (p) => (p.action === requiredAction || p.action === 'ALL') && p.isActive === true
            );

            if (!hasPermission) {
                console.error(`❌ DENIED: Viewer lacks [${requiredAction}] permission.`);
                console.error(`   Active permissions:`, friendship.permissions.filter(p => p.isActive).map(p => p.action));
                return res.status(403).json({
                    success: false,
                    message: `Access denied. You do not have permission to view or manage ${requiredAction} for this user.`
                });
            }

            console.log(`✅ GRANTED: Viewer has valid permissions.`);
            
            // 5. The Context Swap
            req.viewerId = viewerId; 
            req.user.id = targetUserId; 
            
            console.log(`🔄 CONTEXT SWAPPED: req.user.id is now ${req.user.id} (Routing to standard controller)`);
            console.log(`======================================================\n`);

            next();

        } catch (error) {
            console.error("🔥 Error in delegated access middleware:", error);
            res.status(500).json({ success: false, message: "Server error verifying access." });
        }
    };
};

module.exports = { requireDelegatedAccess };