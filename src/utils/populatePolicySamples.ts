import { supabase } from "@/integrations/supabase/client";

const sampleFiles: Record<string, string> = {
  'remote_work': '/temp/remote_work.pdf',
  'data_security': '/temp/data_security.pdf',
  'code_of_conduct': '/temp/code_of_conduct.pdf',
  'expense_reimbursement': '/temp/expense_reimbursement.pdf',
};

export const populatePolicySamples = async () => {
  console.log('Starting policy sample population...');
  
  try {
    // Fetch all policies
    const { data: policies, error: policiesError } = await supabase
      .from('policies')
      .select('*');
    
    if (policiesError) throw policiesError;
    if (!policies || policies.length === 0) {
      throw new Error('No policies found');
    }

    const results = [];

    for (const policy of policies) {
      try {
        // Try to match policy to a sample file
        const policyKey = policy.title.toLowerCase().replace(/\s+/g, '_');
        let samplePath = null;
        
        // Find matching sample file
        for (const [key, path] of Object.entries(sampleFiles)) {
          if (policyKey.includes(key) || policy.category?.toLowerCase().includes(key)) {
            samplePath = path;
            break;
          }
        }

        // Default to a generic sample if no match found
        if (!samplePath) {
          samplePath = '/temp/code_of_conduct.pdf';
        }

        // Fetch the PDF
        const response = await fetch(samplePath);
        if (!response.ok) {
          console.error(`Failed to fetch ${samplePath}`);
          continue;
        }

        const blob = await response.blob();
        const fileName = `${policy.id}_v1.pdf`;
        const file = new File([blob], fileName, { type: 'application/pdf' });

        // Upload to storage
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('policy-documents')
          .upload(fileName, file, {
            cacheControl: '3600',
            upsert: true
          });

        if (uploadError) {
          console.error(`Error uploading ${fileName}:`, uploadError);
          continue;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
          .from('policy-documents')
          .getPublicUrl(fileName);

        // Create policy version
        const { data: versionData, error: versionError } = await supabase
          .from('policy_versions')
          .insert({
            policy_id: policy.id,
            version_number: 1,
            file_url: publicUrl,
            file_name: fileName,
            file_size: file.size,
            change_summary: 'Initial version'
          })
          .select()
          .single();

        if (versionError) {
          console.error(`Error creating version for ${policy.title}:`, versionError);
          continue;
        }

        // Update policy with current version
        const { error: updateError } = await supabase
          .from('policies')
          .update({ current_version_id: versionData.id })
          .eq('id', policy.id);

        if (updateError) {
          console.error(`Error updating policy ${policy.title}:`, updateError);
        } else {
          results.push({ policy: policy.title, success: true });
          console.log(`✓ Populated ${policy.title}`);
        }

      } catch (err) {
        console.error(`Exception processing ${policy.title}:`, err);
        results.push({ policy: policy.title, success: false, error: err });
      }
    }

    console.log('Policy population complete!');
    return results;
  } catch (error) {
    console.error('Failed to populate policies:', error);
    throw error;
  }
};
