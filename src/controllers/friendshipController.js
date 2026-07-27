const ShareableHash = require('../models/ShareableHash');
const Blocklist = require('../models/Blocklist');
const Friendship = require('../models/Friendship');
const UserProfile = require('../models/UserProfile');

// User B scans User A's Hash
exports.connectWithHash = async (req, res) => {
    try {
        const { hashId } = req.params;
        const viewerId = req.user.id; // User B (extracted from requireJWT middleware)
        
        console.log(`[connectWithHash] Initiated by viewerId: ${viewerId} for hashId: ${hashId}`);

        // 1. Find the generated hash
        const hashRecord = await ShareableHash.findOne({ hashId });
        if (!hashRecord) {
            console.log(`[connectWithHash] Failed: Invalid or expired hashId: ${hashId}`);
            return res.status(404).json({ 
                success: false, 
                message: "Invalid or expired QR code." 
            });
        }

        // 2. Verify the hash status
        if (hashRecord.status !== 'ACTIVE') {
            console.log(`[connectWithHash] Failed: Hash ${hashId} is inactive. Status: ${hashRecord.status}`);
            return res.status(403).json({ 
                success: false, 
                message: "This QR code is no longer active." 
            });
        }

        const ownerId = hashRecord.userId; // User A
        console.log(`[connectWithHash] Hash validated. ownerId: ${ownerId}`);

        // 3. Edge Case: Prevent user from scanning their own code
        if (ownerId.toString() === viewerId.toString()) {
            console.log(`[connectWithHash] Failed: User ${viewerId} attempted to scan their own QR code.`);
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
            console.log(`[connectWithHash] Failed: viewerId ${viewerId} is blocked by ownerId ${ownerId}`);
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
        console.log(`[connectWithHash] Permissions mapped for connection:`, permissions);

        // 6. Establish or Update the Friendship
        // Using an upsert handles the scenario where they are already friends 
        // but User B is scanning a new QR code to update their granular permissions.
        let friendship = await Friendship.findOne({ ownerId, viewerId });

        if (friendship) {
            // Overwrite existing permissions with the new hash scopes
            friendship.permissions = permissions;
            await friendship.save();
            
            console.log(`[connectWithHash] Success: Existing friendship updated. Data:`, friendship);
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

            console.log(`[connectWithHash] Success: New friendship created. Data:`, friendship);
            return res.status(201).json({
                success: true,
                message: "Friend added successfully. You now have access.",
                data: friendship
            });
        }

    } catch (error) {
        console.error(`🔥 [connectWithHash] Error connecting via hash (viewerId: ${req.user?.id}):`, error);
        res.status(500).json({ 
            success: false, 
            message: "Server error during connection." 
        });
    }
};

// --------------------------------------------------------
// 1. GET GRANTEES (For User A: People who can see MY data)
// --------------------------------------------------------
exports.getGrantedAccess = async (req, res) => {
    try {
        const ownerId = req.user.id;
        console.log(`[getGrantedAccess] Fetching grantees for ownerId: ${ownerId}`);

        // Find all users that User A has granted access to
        const friendships = await Friendship.find({ ownerId });

        if (!friendships.length) {
            console.log(`[getGrantedAccess] No grantees found for ownerId: ${ownerId}`);
            return res.status(200).json({ success: true, data: [] });
        }

        console.log(`[getGrantedAccess] Found ${friendships.length} active grantees. Fetching profiles...`);

        // Get profiles for all the viewers (User Bs)
        const viewerIds = friendships.map(f => f.viewerId);
        const profiles = await UserProfile.find({ userId: { $in: viewerIds } })
                                          .select('userId name profileImageUri -_id');

        // Merge the profile data with the permissions array
        const mergedData = friendships.map(friendship => {
            const profile = profiles.find(p => p.userId.toString() === friendship.viewerId.toString());
            return {
                friendshipId: friendship._id,
                user: profile || { userId: friendship.viewerId, name: "Unknown User" },
                permissions: friendship.permissions,
                connectedAt: friendship.createdAt
            };
        });

        console.log(`[getGrantedAccess] Successfully retrieved and merged data for ${mergedData.length} grantees.`);
        res.status(200).json({ success: true, data: mergedData });

    } catch (error) {
        console.error(`🔥 [getGrantedAccess] Error fetching granted access for user: ${req.user?.id}:`, error);
        res.status(500).json({ success: false, message: "Server error fetching friends." });
    }
};

// --------------------------------------------------------
// 2. GET OWNERS (For User B: People whose data I can see)
// --------------------------------------------------------
exports.getReceivedAccess = async (req, res) => {
    try {
        const viewerId = req.user.id;
        console.log(`[getReceivedAccess] Fetching owners for viewerId: ${viewerId}`);

        // Find all users who have granted User B access
        const friendships = await Friendship.find({ viewerId });

        if (!friendships.length) {
            console.log(`[getReceivedAccess] No received access found for viewerId: ${viewerId}`);
            return res.status(200).json({ success: true, data: [] });
        }

        console.log(`[getReceivedAccess] Found ${friendships.length} owners granting access. Fetching profiles...`);

        // Get profiles for all the owners (User As)
        const ownerIds = friendships.map(f => f.ownerId);
        const profiles = await UserProfile.find({ userId: { $in: ownerIds } })
                                          .select('userId name profileImageUri -_id');

        // Merge data (Notice B cannot see the friendshipId to prevent them from modifying it)
        const mergedData = friendships.map(friendship => {
            const profile = profiles.find(p => p.userId.toString() === friendship.ownerId.toString());
            return {
                user: profile || { userId: friendship.ownerId, name: "Unknown User" },
                activePermissions: friendship.permissions, // Read-only view of what B is allowed to do
                connectedAt: friendship.createdAt
            };
        });

        console.log(`[getReceivedAccess] Successfully retrieved and merged data for ${mergedData.length} owners.`);
        res.status(200).json({ success: true, data: mergedData });

    } catch (error) {
        console.error(`🔥 [getReceivedAccess] Error fetching received access for user: ${req.user?.id}:`, error);
        res.status(500).json({ success: false, message: "Server error fetching access list." });
    }
};

// --------------------------------------------------------
// 3. UPDATE PERMISSIONS (For User A Only)
// --------------------------------------------------------
exports.updateFriendPermissions = async (req, res) => {
    try {
        const { targetUserId } = req.params; // The ID of User B
        const { permissions } = req.body; // Array of updated permission objects
        const ownerId = req.user.id;

        console.log(`[updateFriendPermissions] ownerId: ${ownerId} updating permissions for targetUserId: ${targetUserId}`);
        console.log(`[updateFriendPermissions] New permissions payload:`, permissions);

        // Security: Ensure the logged-in user is the OWNER of this data
        const updatedFriendship = await Friendship.findOneAndUpdate(
            { ownerId: ownerId, viewerId: targetUserId },
            { $set: { permissions: permissions } },
            { new: true }
        );

        if (!updatedFriendship) {
            console.log(`[updateFriendPermissions] Failed: Friendship not found between ownerId: ${ownerId} and targetUserId: ${targetUserId}`);
            return res.status(404).json({ 
                success: false, 
                message: "Friendship not found or you do not have authorization to modify these permissions." 
            });
        }

        console.log(`[updateFriendPermissions] Success: Permissions updated. Updated Data:`, updatedFriendship.permissions);
        res.status(200).json({
            success: true,
            message: "Permissions updated successfully.",
            data: updatedFriendship.permissions
        });

    } catch (error) {
        console.error(`🔥 [updateFriendPermissions] Error updating permissions for target: ${req.params?.targetUserId}:`, error);
        res.status(500).json({ success: false, message: "Server error updating permissions." });
    }
};

// --------------------------------------------------------
// 4. BLOCK & REPORT (Universal: User A or User B can trigger)
// --------------------------------------------------------
exports.blockAndReportUser = async (req, res) => {
    try {
        const { targetUserId } = req.params;
        const { reason, notes } = req.body;
        const initiatorId = req.user.id;

        console.log(`[blockAndReportUser] initiatorId: ${initiatorId} attempting to block targetUserId: ${targetUserId}`);
        console.log(`[blockAndReportUser] Block Reason: ${reason} | Notes: ${notes || 'None'}`);

        if (!reason) {
            console.log(`[blockAndReportUser] Failed: No reason provided by initiatorId: ${initiatorId}`);
            return res.status(400).json({ success: false, message: "A reason is required to block a user." });
        }

        // 1. Sever ties in BOTH directions to completely wipe access
        // Deletes where Initiator is A and Target is B, OR where Initiator is B and Target is A
        const deletionResult = await Friendship.deleteMany({
            $or: [
                { ownerId: initiatorId, viewerId: targetUserId },
                { ownerId: targetUserId, viewerId: initiatorId }
            ]
        });
        console.log(`[blockAndReportUser] Deleted ${deletionResult.deletedCount} friendship records between ${initiatorId} and ${targetUserId}.`);

        // 2. Add to Blocklist / Report log
        // Using upsert in case they are already blocked to avoid unique constraint errors
        const blockRecord = await Blocklist.findOneAndUpdate(
            { userId: initiatorId, blockedUserId: targetUserId },
            { reason, notes },
            { upsert: true, new: true }
        );
        console.log(`[blockAndReportUser] Blocklist updated/created for initiatorId: ${initiatorId}. Block Record:`, blockRecord);

        res.status(200).json({
            success: true,
            message: "User has been blocked, reported, and all access has been completely revoked."
        });

    } catch (error) {
        console.error(`🔥 [blockAndReportUser] Error blocking/reporting user (target: ${req.params?.targetUserId}):`, error);
        res.status(500).json({ success: false, message: "Server error during block/report process." });
    }
};