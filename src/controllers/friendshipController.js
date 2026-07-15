const ShareableHash = require('../models/ShareableHash');
const Blocklist = require('../models/Blocklist');
const Friendship = require('../models/Friendship');

// User B scans User A's Hash
exports.connectWithHash = async (req, res) => {
    try {
        const { hashId } = req.params;
        const viewerId = req.user.id; // User B (extracted from requireJWT middleware)

        // 1. Find the generated hash
        const hashRecord = await ShareableHash.findOne({ hashId });
        if (!hashRecord) {
            return res.status(404).json({ 
                success: false, 
                message: "Invalid or expired QR code." 
            });
        }

        // 2. Verify the hash status
        if (hashRecord.status !== 'ACTIVE') {
            return res.status(403).json({ 
                success: false, 
                message: "This QR code is no longer active." 
            });
        }

        const ownerId = hashRecord.userId; // User A

        // 3. Edge Case: Prevent user from scanning their own code
        if (ownerId.toString() === viewerId.toString()) {
            return res.status(400).json({ 
                success: false, 
                message: "You cannot scan your own QR code." 
            });
        }

        // 4. Blocklist Validation: Ensure User A hasn't blocked User B
        const isBlocked = await Blocklist.findOne({ 
            userId: ownerId, 
            blockedUserId: viewerId 
        });

        if (isBlocked) {
            return res.status(403).json({ 
                success: false, 
                message: "Access denied. You do not have permission to connect with this user." 
            });
        }

        // 5. Map permissions from the hash
        const permissions = hashRecord.actions.map(action => ({
            action,
            isActive: true
        }));

        // 6. Establish or Update the Friendship
        // Using an upsert handles the scenario where they are already friends 
        // but User B is scanning a new QR code to update their granular permissions.
        let friendship = await Friendship.findOne({ ownerId, viewerId });

        if (friendship) {
            // Overwrite existing permissions with the new hash scopes
            friendship.permissions = permissions;
            await friendship.save();
            
            return res.status(200).json({
                success: true,
                message: "Permissions updated successfully based on new QR code.",
                data: friendship
            });
        } else {
            // Create a brand new connection
            friendship = new Friendship({
                ownerId,
                viewerId,
                permissions
            });
            await friendship.save();

            return res.status(201).json({
                success: true,
                message: "Friend added successfully. You now have access.",
                data: friendship
            });
        }

    } catch (error) {
        console.error("🔥 Error connecting via hash:", error);
        res.status(500).json({ 
            success: false, 
            message: "Server error during connection." 
        });
    }
};