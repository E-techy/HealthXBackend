const Blocklist = require('../models/Blocklist');
const UserProfile = require('../models/UserProfile');

// 1. Get all blocked users (with profile details for the UI)
exports.getBlocklistedUsers = async (req, res) => {
    try {
        // Find all block records for the current user
        const blocks = await Blocklist.find({ userId: req.user.id });
        
        if (!blocks.length) {
            return res.status(200).json({ success: true, data: [] });
        }

        // Extract just the blocked user IDs
        const blockedUserIds = blocks.map(block => block.blockedUserId);

        // Fetch their names and profile images from the UserProfile collection
        const blockedProfiles = await UserProfile.find({ 
            userId: { $in: blockedUserIds } 
        }).select('userId name profileImageUri -_id'); // Exclude the profile _id to avoid confusion

        res.status(200).json({
            success: true,
            data: blockedProfiles
        });

    } catch (error) {
        console.error("🔥 Error fetching blocklist:", error);
        res.status(500).json({ success: false, message: "Server error fetching blocklist." });
    }
};

// 2. Remove a user from the blocklist
exports.removeBlockedUser = async (req, res) => {
    try {
        const { blockedUserId } = req.params;

        const deletedBlock = await Blocklist.findOneAndDelete({
            userId: req.user.id,
            blockedUserId: blockedUserId
        });

        if (!deletedBlock) {
            return res.status(404).json({ 
                success: false, 
                message: "User is not in your blocklist." 
            });
        }

        res.status(200).json({
            success: true,
            message: "User successfully removed from blocklist."
        });

    } catch (error) {
        console.error("🔥 Error removing from blocklist:", error);
        res.status(500).json({ success: false, message: "Server error updating blocklist." });
    }
};