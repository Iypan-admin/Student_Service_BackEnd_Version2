const supabase = require("../config/supabaseClient");

// Helper function to get all batch IDs in a merge group
const getMergedBatchIds = async (batch_id) => {
    try {
        // Check if batch is part of a merge group
        const { data: mergeMember, error: memberError } = await supabase
            .from('batch_merge_members')
            .select('merge_group_id')
            .eq('batch_id', batch_id)
            .single();

        if (memberError || !mergeMember) {
            // Not part of any merge group
            return [batch_id];
        }

        // Get all batch IDs in this merge group
        const { data: allMembers, error: membersError } = await supabase
            .from('batch_merge_members')
            .select('batch_id')
            .eq('merge_group_id', mergeMember.merge_group_id);

        if (membersError || !allMembers) {
            return [batch_id];
        }

        return allMembers.map(member => member.batch_id);
    } catch (error) {
        console.error('Error getting merged batch IDs:', error);
        return [batch_id];
    }
};

// Fetch notes by batch_id (including merged batches)
const getNotesByBatch = async (req, res) => {
    const { batch_id } = req.params;

    try {
        // Get all batch IDs in merge group
        const mergedBatchIds = await getMergedBatchIds(batch_id);

        // Fetch notes from all merged batches
        const { data, error } = await supabase
            .from("notes")
            .select("*")
            .in("batch_id", mergedBatchIds)
            .order("created_at", { ascending: false });

        if (error) {
            return res.status(500).json({ error: "Error fetching notes", details: error.message });
        }

        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: "Error fetching notes", details: error.message });
    }
};

// Fetch GMeets by batch_id (including merged batches)
const getGMeetsByBatch = async (req, res) => {
    const { batch_id } = req.params;

    try {
        // Get all batch IDs in merge group
        const mergedBatchIds = await getMergedBatchIds(batch_id);

        // Fetch schedules from all merged batches
        const { data, error } = await supabase
            .from("gmeets")
            .select("*")
            .in("batch_id", mergedBatchIds)
            .order("date", { ascending: true })
            .order("time", { ascending: true });

        if (error) {
            return res.status(500).json({ error: "Error fetching GMeets", details: error.message });
        }

        return res.status(200).json(data);
    } catch (error) {
        return res.status(500).json({ error: "Error fetching GMeets", details: error.message });
    }
};

module.exports = { getNotesByBatch, getGMeetsByBatch };