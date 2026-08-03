export async function importCSV(file){

const formData=new FormData();

formData.append("file",file);

const res=await fetch(
"/api/reviews/import-csv",
{
method:"POST",
body:formData
}
);

return await res.json();

}