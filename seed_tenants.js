require('dotenv').config();
const { google } = require('googleapis');
const auth = new google.auth.GoogleAuth({
  keyFile: process.env.GOOGLE_CREDENTIALS_PATH,
  scopes: ['https://www.googleapis.com/auth/spreadsheets']
});

const correctTenants = [
  ["John Smith", "john.smith@tenantdesk.com", "Bunyan Towers, Mazgaon, Maharashtra", "A", "101", "+91 9876500011", "1234"],
  ["Ali Khan", "ali.khan@tenantdesk.com", "Sea View Apartments, Colaba, Maharashtra", "A", "102", "+91 9876500012", "1234"],
  ["Rohan Mehta", "rohan.mehta@tenantdesk.com", "Green Residency, Andheri, Maharashtra", "A", "103", "+91 9876500013", "1234"],
  ["Sara Sheikh", "sara.sheikh@tenantdesk.com", "Lakeview Heights, Powai, Maharashtra", "A", "104", "+91 9876500014", "1234"],
  ["David Joseph", "david.joseph@tenantdesk.com", "Palm Grove, Bandra, Maharashtra", "A", "105", "+91 9876500015", "1234"],
  ["Imran Shaikh", "imran.shaikh@tenantdesk.com", "Hill Crest, Thane, Maharashtra", "A", "106", "+91 9876500016", "1234"],
  ["Neha Patel", "neha.patel@tenantdesk.com", "Shanti Towers, Vashi, Maharashtra", "A", "107", "+91 9876500017", "1234"],
  ["Arjun Nair", "arjun.nair@tenantdesk.com", "Sunrise Enclave, Kochi, Kerala", "A", "108", "+91 9876500018", "1234"],
  ["Fatima Noor", "fatima.noor@tenantdesk.com", "Royal Residency, Hyderabad, Telangana", "A", "109", "+91 9876500019", "1234"],
  ["Sameer Desai", "sameer.desai@tenantdesk.com", "Lotus Apartments, Ahmedabad, Gujarat", "A", "110", "+91 9876500020", "1234"],
  ["Karan Shah", "karan.shah@tenantdesk.com", "Silver Oak, Surat, Gujarat", "B", "111", "+91 9876500021", "1234"],
  ["Zoya Ansari", "zoya.ansari@tenantdesk.com", "Pearl Heights, Bhopal, Madhya Pradesh", "B", "112", "+91 9876500022", "1234"],
  ["Rahul Verma", "rahul.verma@tenantdesk.com", "Green Valley, Delhi", "B", "113", "+91 9876500023", "1234"],
  ["Ayesha Khan", "ayesha.khan@tenantdesk.com", "Sky Residency, Noida, Uttar Pradesh", "B", "114", "+91 9876500024", "1234"],
  ["Vikram Singh", "vikram.singh@tenantdesk.com", "Royal Heights, Jaipur, Rajasthan", "B", "115", "+91 9876500025", "1234"],
  ["Pooja Iyer", "pooja.iyer@tenantdesk.com", "Temple View, Chennai, Tamil Nadu", "B", "116", "+91 9876500026", "1234"],
  ["Nikhil Jain", "nikhil.jain@tenantdesk.com", "Lake Palace Apartments, Udaipur, Rajasthan", "B", "117", "+91 9876500027", "1234"],
  ["Sana Malik", "sana.malik@tenantdesk.com", "Metro Towers, Lucknow, Uttar Pradesh", "B", "118", "+91 9876500028", "1234"],
  ["Aditya Rao", "aditya.rao@tenantdesk.com", "Tech Park Residency, Bengaluru, Karnataka", "B", "119", "+91 9876500029", "1234"],
  ["Farhan Ali", "farhan.ali@tenantdesk.com", "Garden Estate, Pune, Maharashtra", "B", "120", "+91 9876500030", "1234"],
  ["Meera Kapoor", "meera.kapoor@tenantdesk.com", "Harmony Homes, Chandigarh", "C", "121", "+91 9876500031", "1234"],
  ["Danish Sheikh", "danish.sheikh@tenantdesk.com", "Riverfront Residency, Ahmedabad, Gujarat", "C", "122", "+91 9876500032", "1234"],
  ["Rohit Agarwal", "rohit.agarwal@tenantdesk.com", "Skyline Towers, Kolkata, West Bengal", "C", "123", "+91 9876500033", "1234"],
  ["Amina Hussain", "amina.hussain@tenantdesk.com", "Emerald Heights, Indore, Madhya Pradesh", "C", "124", "+91 9876500034", "1234"],
  ["Kabir Khan", "kabir.khan@tenantdesk.com", "Crescent Apartments, Aligarh, Uttar Pradesh", "C", "125", "+91 9876500035", "1234"],
  ["Sneha Kulkarni", "sneha.kulkarni@tenantdesk.com", "Orchid Residency, Nagpur, Maharashtra", "C", "126", "+91 9876500036", "1234"],
  ["Yusuf Pathan", "yusuf.pathan@tenantdesk.com", "Sapphire Towers, Vadodara, Gujarat", "C", "127", "+91 9876500037", "1234"],
  ["Ritu Sharma", "ritu.sharma@tenantdesk.com", "Green Meadows, Dehradun, Uttarakhand", "C", "128", "+91 9876500038", "1234"],
  ["Faizan Siddiqui", "faizan.siddiqui@tenantdesk.com", "Central Residency, Patna, Bihar", "C", "129", "+91 9876500039", "1234"],
  ["Kunal Gupta", "kunal.gupta@tenantdesk.com", "Elite Enclave, Gurgaon, Haryana", "C", "130", "+91 9876500040", "1234"],
  ["Aditi Joshi", "aditi.joshi@tenantdesk.com", "Blue Hills, Shimla, Himachal Pradesh", "D", "131", "+91 9876500041", "1234"],
  ["Bilal Qureshi", "bilal.qureshi@tenantdesk.com", "Valley View, Srinagar, Jammu & Kashmir", "D", "132", "+91 9876500042", "1234"],
  ["Varun Malhotra", "varun.malhotra@tenantdesk.com", "Urban Nest, Ludhiana, Punjab", "D", "133", "+91 9876500043", "1234"],
  ["Noor Fatima", "noor.fatima@tenantdesk.com", "Lake City Homes, Bhopal, Madhya Pradesh", "D", "134", "+91 9876500044", "1234"],
  ["Manish Yadav", "manish.yadav@tenantdesk.com", "Royal Gardens, Kanpur, Uttar Pradesh", "D", "135", "+91 9876500045", "1234"],
  ["Shreya Bose", "shreya.bose@tenantdesk.com", "Eden Residency, Kolkata, West Bengal", "D", "136", "+91 9876500046", "1234"],
  ["Omar Farooq", "omar.farooq@tenantdesk.com", "Hill View Apartments, Guwahati, Assam", "D", "137", "+91 9876500047", "1234"],
  ["Anjali Singh", "anjali.singh@tenantdesk.com", "Lotus Valley, Ranchi, Jharkhand", "D", "138", "+91 9876500048", "1234"],
  ["Harsh Vora", "harsh.vora@tenantdesk.com", "Prime Residency, Rajkot, Gujarat", "D", "139", "+91 9876500049", "1234"],
  ["Zahra Abbas", "zahra.abbas@tenantdesk.com", "Crescent Homes, Aurangabad, Maharashtra", "D", "140", "+91 9876500050", "1234"],
  ["Dev Patel", "dev.patel@tenantdesk.com", "Green Park Towers, Surat, Gujarat", "E", "141", "+91 9876500051", "1234"],
  ["Hina Khan", "hina.khan@tenantdesk.com", "Rose Residency, Delhi", "E", "142", "+91 9876500052", "1234"],
  ["Amit Tiwari", "amit.tiwari@tenantdesk.com", "Shanti Enclave, Allahabad, Uttar Pradesh", "E", "143", "+91 9876500053", "1234"],
  ["Samira Ali", "samira.ali@tenantdesk.com", "Ocean View, Kochi, Kerala", "E", "144", "+91 9876500054", "1234"],
  ["Rajiv Menon", "rajiv.menon@tenantdesk.com", "Palm Residency, Trivandrum, Kerala", "E", "145", "+91 9876500055", "1234"],
  ["Nida Shaikh", "nida.shaikh@tenantdesk.com", "Metro Heights, Hyderabad, Telangana", "E", "146", "+91 9876500056", "1234"],
  ["Gaurav Bansal", "gaurav.bansal@tenantdesk.com", "City Square Apartments, Jaipur, Rajasthan", "E", "147", "+91 9876500057", "1234"],
  ["Iqra Khan", "iqra.khan@tenantdesk.com", "Sunrise Towers, Bhopal, Madhya Pradesh", "E", "148", "+91 9876500058", "1234"],
  ["Sandeep Mishra", "sandeep.mishra@tenantdesk.com", "Elite Residency, Varanasi, Uttar Pradesh", "E", "149", "+91 9876500059", "1234"],
  ["Mariam Sheikh", "mariam.sheikh@tenantdesk.com", "Harmony Heights, Pune, Maharashtra", "E", "150", "+91 9876500060", "1234"],
  ["Pranav Kulkarni", "pranav.kulkarni@tenantdesk.com", "Orchid Towers, Mumbai, Maharashtra", "F", "151", "+91 9876500061", "1234"],
  ["Ayaan Khan", "ayaan.khan@tenantdesk.com", "Royal Enclave, Delhi", "F", "152", "+91 9876500062", "1234"],
  ["Rakesh Sharma", "rakesh.sharma@tenantdesk.com", "Green Heights, Noida, Uttar Pradesh", "F", "153", "+91 9876500063", "1234"],
  ["Zainab Ali", "zainab.ali@tenantdesk.com", "Pearl Residency, Hyderabad, Telangana", "F", "154", "+91 9876500064", "1234"],
  ["Deepak Verma", "deepak.verma@tenantdesk.com", "Skyline Apartments, Bengaluru, Karnataka", "F", "155", "+91 9876500065", "1234"],
  ["Saba Siddiqui", "saba.siddiqui@tenantdesk.com", "Lake View Homes, Udaipur, Rajasthan", "F", "156", "+91 9876500066", "1234"],
  ["Ankit Jain", "ankit.jain@tenantdesk.com", "Urban Heights, Indore, Madhya Pradesh", "F", "157", "+91 9876500067", "1234"],
  ["Farah Khan", "farah.khan@tenantdesk.com", "Garden View Residency, Lucknow, Uttar Pradesh", "F", "158", "+91 9876500068", "1234"],
  ["Nitin Gupta", "nitin.gupta@tenantdesk.com", "Metro Enclave, Gurgaon, Haryana", "F", "159", "+91 9876500069", "1234"],
  ["Hammad Ali", "hammad.ali@tenantdesk.com", "Central Towers, Patna, Bihar", "F", "160", "+91 9876500070", "1234"],
  ["Chirag Shah", "chirag.shah@tenantdesk.com", "Silver Residency, Ahmedabad, Gujarat", "G", "161", "+91 9876500071", "1234"],
  ["Mahira Khan", "mahira.khan@tenantdesk.com", "Blue Sky Apartments, Chennai, Tamil Nadu", "G", "162", "+91 9876500072", "1234"],
  ["Abhishek Singh", "abhishek.singh@tenantdesk.com", "Sunrise Homes, Kanpur, Uttar Pradesh", "G", "163", "+91 9876500073", "1234"],
  ["Sana Sheikh", "sana.sheikh@tenantdesk.com", "Hill Crest Towers, Shimla, Himachal Pradesh", "G", "164", "+91 9876500074", "1234"],
  ["Yash Agarwal", "yash.agarwal@tenantdesk.com", "Royal Plaza, Jaipur, Rajasthan", "G", "165", "+91 9876500075", "1234"],
  ["Iram Fatima", "iram.fatima@tenantdesk.com", "Crescent Residency, Aligarh, Uttar Pradesh", "G", "166", "+91 9876500076", "1234"],
  ["Tarun Mehta", "tarun.mehta@tenantdesk.com", "Green Valley Homes, Dehradun, Uttarakhand", "G", "167", "+91 9876500077", "1234"],
  ["Hafsa Khan", "hafsa.khan@tenantdesk.com", "Palm Heights, Kochi, Kerala", "G", "168", "+91 9876500078", "1234"],
  ["Keshav Nair", "keshav.nair@tenantdesk.com", "Tech Residency, Bengaluru, Karnataka", "G", "169", "+91 9876500079", "1234"],
  ["Uzma Sheikh", "uzma.sheikh@tenantdesk.com", "Harmony Enclave, Pune, Maharashtra", "G", "170", "+91 9876500080", "1234"],
  ["Rohan Das", "rohan.das@tenantdesk.com", "Lake View Residency, Kolkata, West Bengal", "H", "171", "+91 9876500081", "1234"],
  ["Aaliya Khan", "aaliya.khan@tenantdesk.com", "Pearl Towers, Hyderabad, Telangana", "H", "172", "+91 9876500082", "1234"],
  ["Mohit Sharma", "mohit.sharma@tenantdesk.com", "Green Residency, Delhi", "H", "173", "+91 9876500083", "1234"],
  ["Nargis Ali", "nargis.ali@tenantdesk.com", "Royal Heights, Mumbai, Maharashtra", "H", "174", "+91 9876500084", "1234"],
  ["Saurabh Gupta", "saurabh.gupta@tenantdesk.com", "Skyline Homes, Noida, Uttar Pradesh", "H", "175", "+91 9876500085", "1234"],
  ["Rabia Siddiqui", "rabia.siddiqui@tenantdesk.com", "Urban Nest, Lucknow, Uttar Pradesh", "H", "176", "+91 9876500086", "1234"],
  ["Vivek Mishra", "vivek.mishra@tenantdesk.com", "Central Residency, Patna, Bihar", "H", "177", "+91 9876500087", "1234"],
  ["Alina Khan", "alina.khan@tenantdesk.com", "Garden Towers, Surat, Gujarat", "H", "178", "+91 9876500088", "1234"],
  ["Pankaj Yadav", "pankaj.yadav@tenantdesk.com", "Elite Apartments, Indore, Madhya Pradesh", "H", "179", "+91 9876500089", "1234"],
  ["Saira Noor", "saira.noor@tenantdesk.com", "Sunrise Enclave, Kochi, Kerala", "H", "180", "+91 9876500090", "1234"]
];

async function fixSheet() {
  try {
    const authClient = await auth.getClient();
    const sheetClient = google.sheets({ version: 'v4', auth: authClient });
    
    console.log("Clearing old incorrect rows...");
    await sheetClient.spreadsheets.values.clear({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Tenants!A1:G1000'
    });

    console.log("Writing correct headers and data...");
    const values = [
      ["name", "email", "location", "wing", "flat", "contact", "password"],
      ...correctTenants
    ];
    
    await sheetClient.spreadsheets.values.update({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: 'Tenants!A1:G' + values.length,
      valueInputOption: 'RAW',
      requestBody: { values }
    });
    
    console.log("✅ Successfully seeded 80 tenants to the Google Sheet.");
  } catch (err) {
    console.error("Error formatting sheet:", err.message);
  }
}

fixSheet();
