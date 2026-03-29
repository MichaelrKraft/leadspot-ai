#!/bin/bash

# Fix unused setTwilioConfigured
sed -i '' 's/const \[_twilioConfigured, setTwilioConfigured\] = useState/const \[_twilioConfigured, _setTwilioConfigured\] = useState/' src/app/sms/page.tsx

# Fix apostrophe in SMS page
sed -i '' "s/We'll configure/We will configure/" src/app/sms/page.tsx

# Fix unused communityId in courses page
sed -i '' 's/const communityId = params.slug;/\/\/ const communityId = params.slug;/' src/app/community/[slug]/courses/page.tsx

echo "Type fixes applied successfully"
